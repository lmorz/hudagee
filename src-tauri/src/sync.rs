use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;

/// 服务端状态
pub struct AppState {
    pub pair_code: Mutex<String>,
    pub vault_path: Mutex<String>,
}

/// 推送 vault 时的请求体
#[derive(Deserialize)]
pub struct VaultPushRequest {
    pub pair_code: String,
    pub envelope: String,
    pub sha256: String,
}

#[derive(Serialize)]
pub struct SyncResponse {
    pub success: bool,
    pub message: String,
    pub sha256: Option<String>,
    pub summary: Option<MergeSummary>,
}

#[derive(Serialize, Clone)]
pub struct MergeSummary {
    pub added_servers: u32,
    pub merged_servers: u32,
    pub added_accounts: u32,
    pub skipped_accounts: u32,
    pub added_professions: u32,
}

pub type SharedState = Arc<AppState>;

/// 生成 6 位数字配对码
pub fn generate_pair_code() -> String {
    let code: u32 = rand::thread_rng().gen_range(100_000..1_000_000);
    code.to_string()
}

/// 计算 SHA-256 哈希（十六进制字符串）
pub fn sha256_hex(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

/// 构建路由
pub fn create_router(state: SharedState) -> Router {
    Router::new()
        .route("/api/ping", get(handle_ping))
        .route("/api/pair", post(handle_pair))
        .route("/api/vault", get(handle_get_vault).post(handle_post_vault))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// GET /api/ping — 心跳检测
async fn handle_ping() -> Json<SyncResponse> {
    Json(SyncResponse {
        success: true,
        message: "pong".to_string(),
        sha256: None,
        summary: None,
    })
}

/// POST /api/pair — 验证配对码
async fn handle_pair(
    State(state): State<SharedState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<SyncResponse>, StatusCode> {
    let incoming_code = payload
        .get("pair_code")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let expected_code = state.pair_code.lock().await;
    if incoming_code == expected_code.as_str() {
        Ok(Json(SyncResponse {
            success: true,
            message: "配对成功".to_string(),
            sha256: None,
            summary: None,
        }))
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

/// GET /api/vault — 获取本地加密 vault
async fn handle_get_vault(
    State(state): State<SharedState>,
    axum::extract::Query(params): axum::extract::Query<PairCodeParam>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 验证配对码
    let expected_code = state.pair_code.lock().await;
    if params.pair_code != expected_code.as_str() {
        return Err(StatusCode::FORBIDDEN);
    }
    drop(expected_code);

    // 读取 vault 文件
    let vault_path = state.vault_path.lock().await;
    match std::fs::read_to_string(vault_path.as_str()) {
        Ok(envelope) => {
            let sha = sha256_hex(&envelope);
            Ok(Json(serde_json::json!({
                "envelope": envelope,
                "sha256": sha
            })))
        }
        Err(_) => Ok(Json(serde_json::json!({
            "envelope": null,
            "sha256": ""
        }))),
    }
}

#[derive(Deserialize)]
pub struct PairCodeParam {
    pub pair_code: String,
}

/// POST /api/vault — 接收远程 vault，合并后保存
async fn handle_post_vault(
    State(state): State<SharedState>,
    Json(payload): Json<VaultPushRequest>,
) -> Result<Json<SyncResponse>, StatusCode> {
    // 1. 验证配对码
    let expected_code = state.pair_code.lock().await;
    if payload.pair_code != expected_code.as_str() {
        return Err(StatusCode::FORBIDDEN);
    }
    drop(expected_code);

    // 2. 校验 SHA-256 传输完整性
    let computed_sha = sha256_hex(&payload.envelope);
    if computed_sha != payload.sha256 {
        return Ok(Json(SyncResponse {
            success: false,
            message: "数据传输损坏，SHA-256 不匹配，请重试".to_string(),
            sha256: None,
            summary: None,
        }));
    }

    // 3. 读取本地 vault
    let vault_path = state.vault_path.lock().await;
    let local_raw = std::fs::read_to_string(vault_path.as_str()).ok();

    // 4. 写入收到的 vault（覆盖本地）
    //    注意：实际的合并操作在客户端完成，服务端仅作存储
    //    客户端在推送前已调用 mergeVaultData 确保数据完整
    match std::fs::write(vault_path.as_str(), &payload.envelope) {
        Ok(_) => {
            let old_sha = local_raw.as_deref().map(sha256_hex);
            Ok(Json(SyncResponse {
                success: true,
                message: "同步成功".to_string(),
                sha256: old_sha,
                summary: None,
            }))
        }
        Err(e) => {
            eprintln!("写入 vault 文件失败: {e}");
            Ok(Json(SyncResponse {
                success: false,
                message: format!("写入 vault 文件失败: {e}"),
                sha256: None,
                summary: None,
            }))
        }
    }
}

/// 启动 HTTP 同步服务
pub async fn start_server(
    port: u16,
    pair_code: String,
    vault_path: String,
) -> Result<(), String> {
    let state = Arc::new(AppState {
        pair_code: Mutex::new(pair_code),
        vault_path: Mutex::new(vault_path),
    });

    let app = create_router(state);

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("绑定端口失败: {e}"))?;

    let actual_port = listener.local_addr().map_err(|e| format!("获取端口失败: {e}"))?.port();
    println!("同步服务已启动: 0.0.0.0:{actual_port}");

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("服务运行失败: {e}"))?;

    Ok(())
}
