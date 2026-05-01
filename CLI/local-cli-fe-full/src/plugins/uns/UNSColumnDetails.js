import React, { useState, useEffect } from 'react';
import { getColumnDetails } from './uns_api';
import './UNSPage.css';

/**
 * Infer if column values are numerical from sample data.
 */
function isColumnNumerical(sqlData, columnName) {
  if (!sqlData || !Array.isArray(sqlData) || !columnName) return false;
  let numericCount = 0;
  let checked = 0;
  for (let i = 0; i < Math.min(sqlData.length, 20); i++) {
    const row = sqlData[i];
    if (row && columnName in row) {
      const v = row[columnName];
      if (v != null && v !== '') {
        checked++;
        if (typeof v === 'number' && !Number.isNaN(v)) numericCount++;
        else if (typeof v === 'string' && !Number.isNaN(parseFloat(v))) numericCount++;
      }
    }
  }
  return checked > 0 && numericCount === checked;
}

const UNSColumnDetails = ({
  conn,
  dbms,
  table,
  column,
  where,
  timeValue,
  timeUnit,
  sqlData,
}) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!conn || !dbms || !table || !column || !sqlData?.length) {
      setDetails(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const columnType = isColumnNumerical(sqlData, column) ? 'numerical' : 'string';

    getColumnDetails(conn, {
      dbms,
      table,
      column,
      where,
      time_value: timeValue,
      time_unit: timeUnit,
      column_type: columnType,
    })
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (result.success && result.data) {
          setDetails(result);
          setError(null);
        } else {
          setDetails(null);
          setError(result.error || 'Failed to load column details');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setDetails(null);
        setError(err.message || 'Failed to load column details');
      });

    return () => { cancelled = true; };
  }, [conn, dbms, table, column, where, timeValue, timeUnit, sqlData]);

  if (!column) return null;

  if (loading) {
    return (
      <div className="uns-column-details">
        <div className="uns-column-details-loading">Loading column details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="uns-column-details">
        <div className="uns-column-details-error">{error}</div>
      </div>
    );
  }

  if (!details?.data) return null;

  const { column_type: colType, data } = details;

  return (
    <div className="uns-column-details">
      <h4 className="uns-column-details-title">Column: {column}</h4>
      {colType === 'numerical' && (
        <div className="uns-column-details-stats">
          <div className="uns-column-details-stat"><span className="uns-column-details-label">Min:</span> {data.min != null ? Number(data.min).toLocaleString() : '—'}</div>
          <div className="uns-column-details-stat"><span className="uns-column-details-label">Max:</span> {data.max != null ? Number(data.max).toLocaleString() : '—'}</div>
          <div className="uns-column-details-stat"><span className="uns-column-details-label">Avg:</span> {data.avg != null ? Number(data.avg).toLocaleString() : '—'}</div>
          <div className="uns-column-details-stat"><span className="uns-column-details-label">Latest:</span> {data.latest_value != null ? Number(data.latest_value).toLocaleString() : '—'}</div>
        </div>
      )}
      {colType === 'string' && (
        <div className="uns-column-details-string">
          <div className="uns-column-details-row">
            <span className="uns-column-details-label">Latest value:</span>{' '}
            <strong>{data.latest_value != null ? String(data.latest_value) : '—'}</strong>
          </div>
          {data.last_occurrence_per_value?.length > 0 && (
            <div className="uns-column-details-row">
              <span className="uns-column-details-label">Last occurrence per value:</span>
              <ul className="uns-column-details-list">
                {data.last_occurrence_per_value.map((item, idx) => (
                  <li key={idx}>
                    <strong>{String(item.value)}</strong>
                    {item.last_timestamp != null && (
                      <span className="uns-column-details-ts"> — {new Date(item.last_timestamp).toLocaleString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UNSColumnDetails;
