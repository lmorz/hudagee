import { render } from "solid-js/web";
import App from "./App";
import { applyAppearance, readAppearance } from "./lib/theme";
import "./style.css";

void applyAppearance(readAppearance());

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

render(() => <App />, root);
