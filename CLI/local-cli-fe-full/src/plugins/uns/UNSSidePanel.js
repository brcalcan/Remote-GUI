import React, { useRef, useState, useEffect } from 'react';
import './UNSPage.css';
import UNSLineChart from './UNSLineChart';
import UNSColumnDetails from './UNSColumnDetails';
import { exportToCSV, exportToPDF } from './unsExportUtils';
import { getDataNodes } from './uns_api';

const UNSSidePanel = ({
  isOpen,
  selectedItem,
  itemsWithData,
  conn,
  sqlData,
  sqlLoading,
  sqlError,
  timeRangeValue,
  timeRangeUnit,
  timeColumn,
  onClose,
  onTimeRangeValueChange,
  onTimeRangeUnitChange,
  onTimeColumnChange,
  onFetchTimeRange,
  getItemName,
  getItemType,
  getItemId,
  getItemData,
  chartYKey,
  onChartYKeyChange,
}) => {
  const itemData = selectedItem ? getItemData(selectedItem) : null;
  const hasTableMeta = itemData && itemData.dbms && itemData.table;
  const tableCacheKey = hasTableMeta ? `${itemData.dbms}:${itemData.table}` : null;
  const hasDataAtLocation = tableCacheKey ? (itemsWithData.get(tableCacheKey) === true) : false;
  const showTableSection = hasTableMeta && hasDataAtLocation;
  const chartRef = useRef(null);

  const [dataNodes, setDataNodes] = useState(null);
  const [dataNodesLoading, setDataNodesLoading] = useState(false);
  const [dataNodesError, setDataNodesError] = useState(null);

  useEffect(() => {
    if (!isOpen || !showTableSection || !conn || !itemData?.dbms || !itemData?.table) {
      setDataNodes(null);
      setDataNodesError(null);
      return;
    }
    let cancelled = false;
    setDataNodesLoading(true);
    setDataNodesError(null);
    getDataNodes(conn, { dbms: itemData.dbms, table: itemData.table })
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setDataNodes(res.data);
        } else {
          setDataNodesError(res.error || 'Failed to fetch data nodes');
          setDataNodes([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setDataNodesError(err.message || 'Failed to fetch data nodes');
        setDataNodes([]);
      })
      .finally(() => {
        if (!cancelled) setDataNodesLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, showTableSection, conn, itemData?.dbms, itemData?.table]);

  const sanitizeForFilename = (s) => (s != null ? String(s).replace(/[/\\:*?"<>|]/g, '-').trim() : '');

  /** Get table columns in order: selected time column first (if present), then others. Only show one time column. */
  const getOrderedTableColumns = (firstRow) => {
    if (!firstRow || typeof firstRow !== 'object') return [];
    const keys = Object.keys(firstRow);
    const keyMatches = (k, target) => k === target || (k && target && String(k).toLowerCase() === String(target).toLowerCase());
    const timeCols = ['insert_timestamp', 'timestamp'];
    const selectedTimeKey = keys.find((k) => keyMatches(k, timeColumn));
    const otherTimeKey = keys.find((k) => keyMatches(k, timeColumn === 'insert_timestamp' ? 'timestamp' : 'insert_timestamp'));
    const rest = keys.filter((k) => !timeCols.some((tc) => keyMatches(k, tc)));
    const displayTimeKey = selectedTimeKey || otherTimeKey;
    const others = rest;
    if (displayTimeKey) {
      return [displayTimeKey, ...others];
    }
    return keys;
  };

  const getExportFilename = () => {
    const parts = [
      'uns',
      selectedItem ? sanitizeForFilename(getItemName(selectedItem)) : null,
      selectedItem ? sanitizeForFilename(getItemType(selectedItem)) : null,
      itemData?.dbms ? sanitizeForFilename(itemData.dbms) : null,
      itemData?.table ? sanitizeForFilename(itemData.table) : null,
    ].filter(Boolean);
    return parts.length > 1 ? parts.join('-') : (parts[0] || 'uns-data');
  };

  const handleExportCSV = () => {
    if (Array.isArray(sqlData) && sqlData.length > 0) {
      exportToCSV(sqlData, getExportFilename());
    }
  };

  const handleExportPDF = async () => {
    if (!Array.isArray(sqlData)) return;
    let chartUrl = null;
    try {
      if (chartRef.current?.getChartAsDataUrl) {
        chartUrl = await chartRef.current.getChartAsDataUrl();
      }
    } catch (e) {
      console.warn('Chart image not available for PDF:', e);
    }
    exportToPDF(sqlData, chartUrl, {
      title: itemData?.table ? `UNS: ${itemData.table}` : 'UNS Report',
      tableTitle: 'Table Data',
      filename: getExportFilename(),
      name: selectedItem ? getItemName(selectedItem) : null,
      type: selectedItem ? getItemType(selectedItem) : null,
      dbms: itemData?.dbms ?? null,
      table: itemData?.table ?? null,
      description: itemData?.description ?? null,
    });
  };

  return (
    <div className={`uns-side-panel ${isOpen ? 'open' : ''}`}>
      <div className="uns-side-panel-header">
        <h3>Item Details</h3>
        <button
          className="uns-side-panel-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="uns-side-panel-content">
        {selectedItem && itemData && (
          <>
            <div className="uns-side-panel-info">
              {itemData.description != null && String(itemData.description).trim() !== '' && (
                <div className="uns-side-panel-description">
                  <strong>Description:</strong>
                  <div className="uns-side-panel-description-text">{String(itemData.description).trim()}</div>
                </div>
              )}
              <div className="uns-side-panel-info-row">
                <strong>Name:</strong> {getItemName(selectedItem)}
              </div>
              <div className="uns-side-panel-info-row">
                <strong>Type:</strong> {getItemType(selectedItem)}
              </div>
              <div className="uns-side-panel-info-row">
                <strong>ID:</strong> {getItemId(selectedItem)}
              </div>
              {showTableSection && (
                <>
                  <div className="uns-side-panel-info-row">
                    <strong>DBMS:</strong> {itemData.dbms}
                  </div>
                  <div className="uns-side-panel-info-row">
                    <strong>Table:</strong> {itemData.table}
                  </div>
                  <div className="uns-side-panel-time-range">
                    <label htmlFor="time-range-value">Time Range:</label>
                    <div className="uns-time-range-controls">
                      <input
                        id="time-range-value"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={timeRangeValue}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 5;
                          onTimeRangeValueChange(value);
                        }}
                        className="uns-time-range-input"
                      />
                      <select
                        id="time-range-unit"
                        value={timeRangeUnit}
                        onChange={(e) => {
                          onTimeRangeUnitChange(e.target.value);
                        }}
                        className="uns-time-range-unit"
                      >
                        <option value="minute">Minutes</option>
                        <option value="hour">Hours</option>
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                      </select>
                      <select
                        id="time-column"
                        value={timeColumn}
                        onChange={(e) => onTimeColumnChange(e.target.value)}
                        className="uns-time-column-select"
                        title="Time column used for filtering"
                      >
                        <option value="insert_timestamp">insert_timestamp</option>
                        <option value="timestamp">timestamp</option>
                      </select>
                      <button
                        onClick={() => {
                          if (showTableSection) {
                            onFetchTimeRange(itemData.dbms, itemData.table, itemData.where, itemData.column);
                          }
                        }}
                        disabled={sqlLoading}
                        className="uns-time-range-refresh-btn"
                      >
                        {sqlLoading ? 'Loading...' : '🔄 Refresh'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {showTableSection && (
              <div className="uns-side-panel-sql">
                <div className="uns-sql-tab-content">
                    <div className="uns-sql-header">
                      <strong>
                        Table Data (Last {timeRangeValue} {timeRangeUnit}
                        {timeRangeValue !== 1 ? 's' : ''}):
                      </strong>
                      {sqlData && sqlData.length > 0 && (
                        <>
                          <span className="uns-sql-row-count">
                            ({sqlData.length} row{sqlData.length !== 1 ? 's' : ''})
                          </span>
                          <div className="uns-sql-export-btns">
                            <button type="button" onClick={handleExportCSV} className="uns-export-btn" title="Export table to CSV">
                              Export CSV
                            </button>
                            <button type="button" onClick={handleExportPDF} className="uns-export-btn" title="Export table and chart to PDF">
                              Export PDF
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {sqlLoading && (
                      <div className="uns-sql-loading">Loading table data...</div>
                    )}
                    {sqlError && (
                      <div className={sqlError.includes('no table/data') ? 'uns-sql-empty' : 'uns-sql-error'}>
                        {sqlError.includes('no table/data') ? (
                          sqlError
                        ) : (
                          <>
                            <strong>Error:</strong> {sqlError}
                          </>
                        )}
                      </div>
                    )}
                    {!sqlLoading && !sqlError && Array.isArray(sqlData) && (
                      <>
                        <div className="uns-sql-table-container">
                          {sqlData.length === 0 ? (
                            <div className="uns-sql-empty">
                              No data found for the specified time range.
                            </div>
                          ) : (
                            <table className="uns-sql-table">
                              <thead>
                                <tr>
                                  {sqlData[0] && getOrderedTableColumns(sqlData[0]).map((key) => (
                                    <th key={key}>{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sqlData.map((row, index) => {
                                  const orderedKeys = sqlData[0] && typeof sqlData[0] === 'object'
                                    ? getOrderedTableColumns(sqlData[0])
                                    : (row && typeof row === 'object' ? Object.keys(row) : []);
                                  return (
                                    <tr key={index}>
                                      {row && typeof row === 'object'
                                        ? orderedKeys.map((key) => (
                                            <td key={key}>
                                              {key in row
                                                ? (typeof row[key] === 'object' && row[key] !== null
                                                    ? JSON.stringify(row[key])
                                                    : String(row[key] ?? ''))
                                                : ''}
                                            </td>
                                          ))
                                        : <td>{String(row ?? '')}</td>}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                        <UNSLineChart
                          ref={chartRef}
                          sqlData={sqlData}
                          chartYKey={chartYKey}
                          onChartYKeyChange={onChartYKeyChange}
                          preferredColumn={itemData?.column}
                          timeColumnKey={timeColumn}
                        />
                        {itemData?.column && (
                          <UNSColumnDetails
                            conn={conn}
                            dbms={itemData.dbms}
                            table={itemData.table}
                            column={itemData.column}
                            where={itemData.where}
                            timeValue={timeRangeValue}
                            timeUnit={timeRangeUnit}
                            sqlData={sqlData}
                          />
                        )}
                      </>
                    )}
                  </div>
              </div>
            )}

            {showTableSection && (
              <div className="uns-data-nodes-section">
                <strong>Data Nodes:</strong>
                {dataNodesLoading && (
                  <div className="uns-data-nodes-loading">Loading data nodes...</div>
                )}
                {dataNodesError && (
                  <div className="uns-data-nodes-error">
                    <strong>Error:</strong> {dataNodesError}
                  </div>
                )}
                {!dataNodesLoading && !dataNodesError && Array.isArray(dataNodes) && (
                  dataNodes.length === 0 ? (
                    <div className="uns-data-nodes-empty">No data nodes found.</div>
                  ) : (
                    <div className="uns-data-nodes-table-container">
                      <table className="uns-sql-table">
                        <thead>
                          <tr>
                            {Object.keys(dataNodes[0]).map((key) => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataNodes.map((node, idx) => (
                            <tr key={idx}>
                              {Object.keys(dataNodes[0]).map((key) => (
                                <td key={key}>
                                  {typeof node[key] === 'object' && node[key] !== null
                                    ? JSON.stringify(node[key])
                                    : String(node[key] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="uns-side-panel-json">
              <strong>UNS Policy:</strong>
              <pre>{JSON.stringify(itemData, null, 2)}</pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UNSSidePanel;

