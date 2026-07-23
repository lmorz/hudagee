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
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};
use tower_http::cors::CorsLayer;

/// 服务端状态
pub struct AppState {
    pub pair_code: Mutex<String>,
    pub vault_path: Mutex<String>,
    pub app: AppHandle,
}

/// 推送 vault 时的请求体
#[derive(Deserialize)]
pub struct VaultPushRequest {
    pub pair_code: String,
    pub envelope: String,
    pub sha256: String,
}

#[derive(Serialize, Deserialize)]
pub struct SyncResponse {
    pub success: bool,
    pub message: String,
    pub sha256: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct VaultPullPayload {
    pub envelope: Option<String>,
    pub sha256: String,
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

fn normalize_base_url(remote_url: &str) -> String {
    remote_url.trim().trim_end_matches('/').to_string()
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
        }))
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

/// GET /api/vault — 获取本地加密 vault（dumb 存储，不做解密/合并）
async fn handle_get_vault(
    State(state): State<SharedState>,
    axum::extract::Query(params): axum::extract::Query<PairCodeParam>,
) -> Result<Json<VaultPullPayload>, StatusCode> {
    let expected_code = state.pair_code.lock().await;
    if params.pair_code != expected_code.as_str() {
        return Err(StatusCode::FORBIDDEN);
    }
    drop(expected_code);

    let vault_path = state.vault_path.lock().await;
    match std::fs::read_to_string(vault_path.as_str()) {
        Ok(envelope) => {
            let sha = sha256_hex(&envelope);
            Ok(Json(VaultPullPayload {
                envelope: Some(envelope),
                sha256: sha,
            }))
        }
        Err(_) => Ok(Json(VaultPullPayload {
            envelope: None,
            sha256: String::new(),
        })),
    }
}

#[derive(Deserialize)]
pub struct PairCodeParam {
    pub pair_code: String,
}

/// POST /api/vault — 接收远程加密 vault 并覆盖本地文件（合并在客户端完成）
async fn handle_post_vault(
    State(state): State<SharedState>,
    Json(payload): Json<VaultPushRequest>,
) -> Result<Json<SyncResponse>, StatusCode> {
    let expected_code = state.pair_code.lock().await;
    if payload.pair_code != expected_code.as_str() {
        return Err(StatusCode::FORBIDDEN);
    }
    drop(expected_code);

    let computed_sha = sha256_hex(&payload.envelope);
    if computed_sha != payload.sha256 {
        return Ok(Json(SyncResponse {
            success: false,
            message: "数据传输损坏，SHA-256 不匹配，请重试".to_string(),
            sha256: None,
        }));
    }

    let vault_path = state.vault_path.lock().await;
    match std::fs::write(vault_path.as_str(), &payload.envelope) {
        Ok(_) => {
            let _ = state.app.emit("sync-vault-updated", ());
            Ok(Json(SyncResponse {
                success: true,
                message: "同步成功".to_string(),
                sha256: Some(computed_sha),
            }))
        }
        Err(e) => {
            eprintln!("写入 vault 文件失败: {e}");
            Ok(Json(SyncResponse {
                success: false,
                message: format!("写入 vault 文件失败: {e}"),
                sha256: None,
            }))
        }
    }
}

/// 启动 HTTP 同步服务（可通过 shutdown 信号优雅退出）。
/// `ready` 在端口绑定成功/失败后立即通知调用方，避免未监听却回报成功。
pub async fn start_server(
    port: u16,
    pair_code: String,
    vault_path: String,
    app: AppHandle,
    shutdown: oneshot::Receiver<()>,
    ready: oneshot::Sender<Result<u16, String>>,
) -> Result<(), String> {
    let state = Arc::new(AppState {
        pair_code: Mutex::new(pair_code),
        vault_path: Mutex::new(vault_path),
        app,
    });

    let router = create_router(state);

    let addr = format!("0.0.0.0:{port}");
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => listener,
        Err(e) => {
            let msg = format!("绑定端口失败: {e}");
            let _ = ready.send(Err(msg.clone()));
            return Err(msg);
        }
    };

    let actual_port = match listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(e) => {
            let msg = format!("获取端口失败: {e}");
            let _ = ready.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    println!("同步服务已启动: 0.0.0.0:{actual_port}");
    let _ = ready.send(Ok(actual_port));

    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = shutdown.await;
        })
        .await
        .map_err(|e| format!("服务运行失败: {e}"))?;

    Ok(())
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))
}

/// 客户端：心跳检测
pub async fn client_ping(remote_url: &str) -> Result<bool, String> {
    let url = format!("{}/api/ping", normalize_base_url(remote_url));
    let client = http_client()?;
    match client.get(&url).send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// 客户端：拉取远程加密 vault
/// 返回 Ok(None) 表示远程暂无数据；Ok(Some(envelope)) 为原始 envelope JSON 字符串
pub async fn client_pull(remote_url: &str, pair_code: &str) -> Result<Option<String>, String> {
    let url = format!(
        "{}/api/vault?pair_code={}",
        normalize_base_url(remote_url),
        urlencoding_pair_code(pair_code)
    );
    let client = http_client()?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("连接远程设备失败: {e}"))?;

    let status = resp.status();
    if status.as_u16() == 403 {
        return Err("配对码错误".to_string());
    }
    if !status.is_success() {
        return Err(format!("连接失败 ({status})"));
    }

    let data: VaultPullPayload = resp
        .json()
        .await
        .map_err(|e| format!("解析远程响应失败: {e}"))?;

    match data.envelope {
        Some(envelope) => {
            let computed = sha256_hex(&envelope);
            if computed != data.sha256 {
                return Err("数据传输损坏，请重试".to_string());
            }
            Ok(Some(envelope))
        }
        None => Ok(None),
    }
}

/// 客户端：推送加密 vault
pub async fn client_push(remote_url: &str, pair_code: &str, envelope: &str) -> Result<(), String> {
    let url = format!("{}/api/vault", normalize_base_url(remote_url));
    let sha = sha256_hex(envelope);
    let client = http_client()?;
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "pair_code": pair_code,
            "envelope": envelope,
            "sha256": sha,
        }))
        .send()
        .await
        .map_err(|e| format!("连接远程设备失败: {e}"))?;

    let status = resp.status();
    if status.as_u16() == 403 {
        return Err("配对码错误".to_string());
    }
    if !status.is_success() {
        return Err(format!("推送失败 ({status})"));
    }

    let data: SyncResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析远程响应失败: {e}"))?;

    if !data.success {
        return Err(data.message);
    }
    Ok(())
}

fn urlencoding_pair_code(pair_code: &str) -> String {
    // 配对码仅为数字，安全直接拼接；仍做基础清理
    pair_code
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}
