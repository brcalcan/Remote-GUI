import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const _originalEntries = Object.entries;
const _originalKeys = Object.keys;
const _originalValues = Object.values;

Object.entries = function (obj) {
  if (obj == null) return [];
  return _originalEntries.call(Object, obj);
};
Object.keys = function (obj) {
  if (obj == null) return [];
  return _originalKeys.call(Object, obj);
};
Object.values = function (obj) {
  if (obj == null) return [];
  return _originalValues.call(Object, obj);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
