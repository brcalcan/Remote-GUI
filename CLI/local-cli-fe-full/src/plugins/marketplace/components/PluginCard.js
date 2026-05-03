import React, { useState } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { FaCircle } from "react-icons/fa";

const PluginCard = ({
  plugin,
  installed,
  enabled,
  onInstall,
  onEnabledStateChange,
  onUninstall,
  onExpand,
  onTriggerMetrics,
  updateInfo = null,
  onUpdate,
  updateInProgress = false,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); };
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "20px", border: "1px solid #f3f4f6", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div style={{ position: "relative", width: "64px", height: "64px" }}>
          {plugin.thumbnail && (
            // <img src={plugin.thumbnail} style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "cover" }} alt="" />
            <img src={plugin.thumbnail}
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "20px",
                objectFit: "cover",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
          )
          }
          {plugin.authorThumbnail && (
            <img src={plugin.authorThumbnail} style={{ width: "18px", height: "18px", borderRadius: "50%", objectFit: "cover", position: "absolute", bottom: "-2px", right: "-2px", border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} alt="" />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>{plugin.core.name}</h3>
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ margin: 0, fontSize: "13px", fontWeight: "400" }}>{plugin.core.slug}</span>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>v{plugin.core.version}</span>
          </div>
        </div>
        <button onClick={onExpand} style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}>
          Details
        </button>
      </div>

      <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "40px" }}>
        {plugin.core.description}
      </p>

      <div style={{ marginTop: "auto" }}>
        {!installed ? (
          <button onClick={onInstall} style={{ width: "100%", padding: "10px", borderRadius: "12px", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", cursor: "pointer", fontSize: "14px" }}>
            Install
          </button>
        ) : (
          <>
            {updateInfo && onUpdate && (
              <div className="mp-plugin-update-row">
                <div className="mp-plugin-update-meta">
                  Update available: installed v{updateInfo.installedVersion} → registry v
                  {updateInfo.latestVersion}
                </div>
                <button
                  type="button"
                  className="mp-plugin-update-btn"
                  disabled={updateInProgress}
                  onClick={() => onUpdate()}
                >
                  {updateInProgress ? "Updating…" : `Update to v${updateInfo.latestVersion}`}
                </button>
              </div>
            )}
            <div style={{ display: "inline-flex", alignItems: "center", borderRadius: "999px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", overflow: "hidden", width: "100%" }}>
              <button onClick={onTriggerMetrics} style={{ flex: 1, padding: "10px 16px", border: "none", background: "transparent", fontWeight: "600", fontSize: "13px", color: "#111827", cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" }}>
                View logs and metrics
              </button>
              <div style={{ width: "1px", height: "20px", backgroundColor: "#e5e7eb", flexShrink: 0 }} />
              <button onClick={handleMenuOpen} style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", color: "#6b7280" }}>
                <ArrowDropDownIcon />
              </button>
            </div>

            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              slotProps={{ paper: { style: { borderRadius: "14px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", padding: "4px", marginTop: "4px" } } }}
            >
              <MenuItem
                onClick={() => { onEnabledStateChange(enabled); handleMenuClose(); }}
                style={{ borderRadius: "10px", fontSize: "13px", fontWeight: "600" }}
              >
                <span style={{ marginRight: "10px" }}>
                  <FaCircle color={enabled ? "red" : "green"} />
                </span>
                {enabled ? "Disable" : "Enable"}
              </MenuItem>

              <Divider style={{ margin: "4px 0" }} />

              <MenuItem
                onClick={() => { onUninstall(); handleMenuClose(); }}
                style={{ borderRadius: "10px", fontSize: "13px", fontWeight: "600", color: "#dc2626" }}
              >
                <span style={{ marginRight: "10px" }}>🗑️</span>
                Uninstall
              </MenuItem>
            </Menu>
          </>
        )}
      </div>
    </div>
  );
};

export default PluginCard;