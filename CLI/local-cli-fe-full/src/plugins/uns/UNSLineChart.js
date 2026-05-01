import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './UNSPage.css';

const UNSLineChart = forwardRef(({ sqlData, chartYKey, onChartYKeyChange, preferredColumn, timeColumnKey = 'insert_timestamp' }, ref) => {
  const [chartViewStart, setChartViewStart] = useState(0);
  const [chartViewEnd, setChartViewEnd] = useState(null);
  const chartContainerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartViewRef = useRef({ start: 0, end: 0 });
  const chartDataRef = useRef(null);
  const chartViewRef = useRef({ start: 0, end: 0, range: 0, total: 0 });
  const scrollbarTrackRef = useRef(null);
  const isScrollbarDraggingRef = useRef(false);
  const scrollbarDragStartXRef = useRef(0);
  const scrollbarDragStartViewRef = useRef({ start: 0, end: 0 });

  // Reset chart zoom/pan when data, value column, or time column changes
  useEffect(() => {
    setChartViewStart(0);
    setChartViewEnd(null);
  }, [sqlData, chartYKey, timeColumnKey]);

  // Global mouse handlers for chart drag and scrollbar thumb drag
  useEffect(() => {
    const handleMove = (e) => {
      // Scrollbar thumb drag
      if (isScrollbarDraggingRef.current && scrollbarTrackRef.current) {
        e.preventDefault();
        const view = chartViewRef.current;
        if (!view.total || view.range === 0) return;
        const rect = scrollbarTrackRef.current.getBoundingClientRect();
        const trackWidth = rect.width;
        const deltaX = e.clientX - scrollbarDragStartXRef.current;
        const indexDelta = Math.round((deltaX / trackWidth) * view.total);
        const newStart = Math.max(0, Math.min(view.total - view.range, scrollbarDragStartViewRef.current.start + indexDelta));
        const newEnd = Math.min(view.total - 1, newStart + view.range - 1);
        setChartViewStart(newStart);
        setChartViewEnd(newEnd);
        return;
      }
      // Chart drag
      if (!isDraggingRef.current || !chartContainerRef.current) return;
      e.preventDefault();
      
      const view = chartViewRef.current;
      if (!view.total || view.range === 0) return;
      
      const deltaX = e.clientX - dragStartXRef.current;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const chartWidth = rect.width;
      
      const pointDelta = Math.round((deltaX / chartWidth) * view.range);
      const newStart = Math.max(0, Math.min(view.total - view.range, dragStartViewRef.current.start - pointDelta));
      const newEnd = Math.min(view.total - 1, newStart + view.range - 1);
      
      setChartViewStart(newStart);
      setChartViewEnd(newEnd);
    };
    
    const handleUp = () => {
      if (chartContainerRef.current) {
        chartContainerRef.current.style.cursor = 'grab';
      }
      isDraggingRef.current = false;
      isScrollbarDraggingRef.current = false;
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const getChartAsDataUrl = () => new Promise((resolve, reject) => {
    if (!chartContainerRef.current) {
      reject(new Error('Chart not ready'));
      return;
    }
    const svgEl = chartContainerRef.current.querySelector('.recharts-wrapper svg') || chartContainerRef.current.querySelector('svg');
    if (!svgEl) {
      reject(new Error('Chart SVG not found'));
      return;
    }
    const clone = svgEl.cloneNode(true);
    const width = 800;
    const height = 440;
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load chart image'));
    };
    img.src = url;
  });

  useImperativeHandle(ref, () => ({
    getChartAsDataUrl,
  }), []);

  if (!sqlData || !Array.isArray(sqlData) || sqlData.length === 0) {
    return null;
  }

  const firstRow = sqlData[0];
  const desiredTimeKey = timeColumnKey || 'insert_timestamp';
  const timeKey = firstRow && (desiredTimeKey in firstRow)
    ? desiredTimeKey
    : firstRow && Object.keys(firstRow).find((k) => k.toLowerCase() === (desiredTimeKey || '').toLowerCase());
  if (!firstRow || !timeKey) {
    return null;
  }

  const valueCandidates = Object.keys(firstRow).filter((key) => {
    if (['row_id', 'tsd_name', 'tsd_id', 'insert_timestamp', 'timestamp'].includes(key)) return false;
    const v = firstRow[key];
    if (typeof v === 'number') return true;
    return !Number.isNaN(parseFloat(v));
  });

  if (valueCandidates.length === 0) {
    return null;
  }

  const effectiveYKey = chartYKey && valueCandidates.includes(chartYKey)
    ? chartYKey
    : preferredColumn && valueCandidates.includes(preferredColumn)
      ? preferredColumn
      : valueCandidates[0];

  // Build chart data for Recharts: [{ time, value, fullTime }] sorted by time
  const chartData = sqlData
    .map((row) => {
      const tsRaw = row[timeKey];
      const t = Date.parse(tsRaw);
      const vRaw = row[effectiveYKey];
      const v = typeof vRaw === 'number' ? vRaw : parseFloat(vRaw);
      if (Number.isNaN(t) || Number.isNaN(v)) return null;
      const d = new Date(t);
      const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        time: timeLabel,
        value: v,
        fullTime: d.toLocaleString(),
      };
    })
    .filter((p) => p !== null)
    .sort((a, b) => new Date(a.fullTime) - new Date(b.fullTime));

  if (chartData.length === 0) {
    return null;
  }

  const ZOOM_THRESHOLD = 50;
  const canZoom = chartData.length > ZOOM_THRESHOLD;
  const totalPoints = chartData.length;
  const endIndex = chartViewEnd != null ? Math.min(chartViewEnd, totalPoints - 1) : totalPoints - 1;
  const startIndex = Math.max(0, Math.min(chartViewStart, endIndex - 1));
  const displayedData = canZoom ? chartData.slice(startIndex, endIndex + 1) : chartData;
  const viewRange = endIndex - startIndex + 1;
  
  // Update refs for mouse handlers
  chartDataRef.current = chartData;
  chartViewRef.current = { start: startIndex, end: endIndex, range: viewRange, total: totalPoints };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload;
    return (
      <div className="uns-chart-tooltip">
        <div className="uns-chart-tooltip-time">{point.fullTime}</div>
        <div className="uns-chart-tooltip-value">
          {effectiveYKey}: <strong>{Number(point.value).toLocaleString()}</strong>
        </div>
      </div>
    );
  };

  // Zoom in/out centered on current view
  const ZOOM_FACTOR = 1.4;
  const handleZoomIn = () => {
    if (!canZoom) return;
    const mid = startIndex + Math.floor(viewRange / 2);
    const newRange = Math.max(10, Math.round(viewRange / ZOOM_FACTOR));
    const newStart = Math.max(0, Math.min(mid - Math.floor(newRange / 2), totalPoints - newRange));
    const newEnd = Math.min(totalPoints - 1, newStart + newRange - 1);
    setChartViewStart(newStart);
    setChartViewEnd(newEnd);
  };
  const handleZoomOut = () => {
    if (!canZoom) return;
    const mid = startIndex + Math.floor(viewRange / 2);
    const newRange = Math.min(totalPoints, Math.round(viewRange * ZOOM_FACTOR));
    const newStart = Math.max(0, Math.min(mid - Math.floor(newRange / 2), totalPoints - newRange));
    const newEnd = Math.min(totalPoints - 1, newStart + newRange - 1);
    setChartViewStart(newStart);
    setChartViewEnd(newEnd);
  };

  const handleExportImage = () => {
    getChartAsDataUrl().then((pngUrl) => {
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `chart-${effectiveYKey || 'export'}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    }).catch(console.error);
  };

  return (
    <div className="uns-sql-chart">
      <div className="uns-sql-chart-header">
        <span>Line Chart</span>
        <div className="uns-sql-chart-controls">
          <label htmlFor="uns-sql-chart-ykey">Value column:</label>
          <select
            id="uns-sql-chart-ykey"
            value={effectiveYKey}
            onChange={(e) => onChartYKeyChange && onChartYKeyChange(e.target.value)}
          >
            {valueCandidates.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleExportImage} className="uns-sql-chart-export-btn" title="Export as image" aria-label="Export chart as image">
            Export image
          </button>
          {canZoom && (
            <>
              <div className="uns-sql-chart-zoom-btns">
                <button type="button" onClick={handleZoomIn} className="uns-sql-chart-zoom-btn" title="Zoom in" aria-label="Zoom in">
                  +
                </button>
                <button type="button" onClick={handleZoomOut} className="uns-sql-chart-zoom-btn" title="Zoom out" aria-label="Zoom out">
                  −
                </button>
              </div>
              <span className="uns-sql-chart-zoom-hint">Hold and drag to move</span>
            </>
          )}
        </div>
      </div>
      <div 
        id="uns-chart-view"
        className="uns-sql-chart-body"
        ref={chartContainerRef}
        onMouseDown={(e) => {
          if (!canZoom || !chartContainerRef.current) return;
          if (e.button !== 0) return; // Only left mouse button
          e.preventDefault();
          isDraggingRef.current = true;
          dragStartXRef.current = e.clientX;
          dragStartViewRef.current = { start: startIndex, end: endIndex };
          chartContainerRef.current.style.cursor = 'grabbing';
        }}
        style={{ cursor: canZoom ? 'grab' : 'default' }}
      >
        <ResponsiveContainer width="100%" height={220} aspect={undefined}>
          <LineChart
            data={displayedData}
            margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
              stroke="#6c757d"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#6c757d"
              tickFormatter={(v) => (Number.isInteger(v) ? v : v.toFixed(2))}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#007bff', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#007bff"
              strokeWidth={2}
              dot={displayedData.length <= 80 ? { r: 3, fill: '#007bff' } : false}
              activeDot={{ r: 5, fill: '#0056b3', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
        {canZoom && (
          <div
            className="uns-sql-chart-scrollbar"
            ref={scrollbarTrackRef}
            role="scrollbar"
            aria-controls="uns-chart-view"
            aria-valuenow={startIndex}
            aria-valuemin={0}
            aria-valuemax={totalPoints - viewRange}
            aria-label="Chart time range"
            onMouseDown={(e) => {
              if (!scrollbarTrackRef.current || e.button !== 0) return;
              const rect = scrollbarTrackRef.current.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const trackWidth = rect.width;
              const thumbLeftPct = (startIndex / totalPoints) * 100;
              const thumbWidthPct = (viewRange / totalPoints) * 100;
              const clickPct = (clickX / trackWidth) * 100;
              // If click is on the thumb, start drag
              if (clickPct >= thumbLeftPct && clickPct <= thumbLeftPct + thumbWidthPct) {
                e.preventDefault();
                isScrollbarDraggingRef.current = true;
                scrollbarDragStartXRef.current = e.clientX;
                scrollbarDragStartViewRef.current = { start: startIndex, end: endIndex };
              } else {
                // Click on track: center view on clicked position
                const targetStart = Math.round((clickPct / 100) * totalPoints - viewRange / 2);
                const newStart = Math.max(0, Math.min(targetStart, totalPoints - viewRange));
                const newEnd = Math.min(totalPoints - 1, newStart + viewRange - 1);
                setChartViewStart(newStart);
                setChartViewEnd(newEnd);
              }
            }}
          >
            <div
              className="uns-sql-chart-scrollbar-thumb"
              style={{
                left: `${(startIndex / totalPoints) * 100}%`,
                width: `${(viewRange / totalPoints) * 100}%`,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (e.button !== 0) return;
                e.preventDefault();
                isScrollbarDraggingRef.current = true;
                scrollbarDragStartXRef.current = e.clientX;
                scrollbarDragStartViewRef.current = { start: startIndex, end: endIndex };
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

UNSLineChart.displayName = 'UNSLineChart';

export default UNSLineChart;
