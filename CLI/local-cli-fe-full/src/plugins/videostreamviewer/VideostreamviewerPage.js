import React, { useState, useEffect } from 'react';
import '../../styles/VideoStreamViewerPage.css';

const STORAGE_KEY = 'video-stream-viewer-streams';
const GRID_STORAGE_KEY = 'video-stream-viewer-columns';
const DEFAULT_COLUMNS = 2;
const DEFAULT_ASPECT_RATIO = 'auto';
const DEFAULT_RATIO_CONFIG = { ratio: 16 / 9, percent: 56.25 };

const getInitialStreams = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((stream) => ({
          ...stream,
          aspectRatio: stream?.aspectRatio || DEFAULT_ASPECT_RATIO
        }));
      }
    }
  } catch (error) {
    console.warn('Failed to read saved streams:', error);
  }
  return [];
};

const getInitialColumns = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_COLUMNS;
  }

  const saved = Number(window.localStorage.getItem(GRID_STORAGE_KEY));
  if (!Number.isNaN(saved) && saved >= 1 && saved <= 4) {
    return saved;
  }
  return DEFAULT_COLUMNS;
};

const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.ts'];
const ASPECT_RATIO_PRESETS = {
  '16:9': { ratio: 16 / 9, percent: 56.25 },
  '4:3': { ratio: 4 / 3, percent: 75 },
  '1:1': { ratio: 1, percent: 100 },
  '9:16': { ratio: 9 / 16, percent: 177.78 }
};

const ASPECT_RATIO_OPTIONS = [
  { key: 'auto', label: 'Auto (detected)' },
  { key: '16:9', label: '16:9' },
  { key: '4:3', label: '4:3' },
  { key: '1:1', label: '1:1' },
  { key: '9:16', label: '9:16' },
  { key: 'fit', label: 'Free Height' }
];

const isDirectVideoSource = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return DIRECT_VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch (error) {
    const lower = url.toLowerCase();
    return DIRECT_VIDEO_EXTENSIONS.some((ext) => lower.includes(ext));
  }
};

const getUrlRatioGuess = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const widthParam = parsed.searchParams.get('width') || parsed.searchParams.get('w');
    const heightParam = parsed.searchParams.get('height') || parsed.searchParams.get('h');
    const width = widthParam ? parseFloat(widthParam) : null;
    const height = heightParam ? parseFloat(heightParam) : null;
    if (width && height && width > 0 && height > 0) {
      return { ratio: width / height, percent: (height / width) * 100 };
    }
  } catch (error) {
    // ignore parsing failure
  }

  const match = url.match(/(\d+)(?:x|×)(\d+)/i);
  if (match) {
    const width = parseFloat(match[1]);
    const height = parseFloat(match[2]);
    if (width && height && width > 0 && height > 0) {
      return { ratio: width / height, percent: (height / width) * 100 };
    }
  }
  return null;
};

const getRatioConfig = (stream, detectedRatios) => {
  const ratioKey = stream?.aspectRatio || DEFAULT_ASPECT_RATIO;
  if (ratioKey === 'auto') {
    return (
      detectedRatios[stream.id] ||
      getUrlRatioGuess(stream?.url) ||
      DEFAULT_RATIO_CONFIG
    );
  }
  if (ratioKey === 'fit') {
    return null;
  }
  return ASPECT_RATIO_PRESETS[ratioKey] || DEFAULT_RATIO_CONFIG;
};

const VideostreamviewerPage = () => {
  const [streams, setStreams] = useState(() => getInitialStreams());
  const [formValues, setFormValues] = useState({ title: '', url: '' });
  const [error, setError] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [targetIndex, setTargetIndex] = useState(null);
  const [columns, setColumns] = useState(() => getInitialColumns());
  const [editingStreamId, setEditingStreamId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [detectedRatios, setDetectedRatios] = useState({});

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(streams));
    } catch (storageError) {
      console.warn('Failed to persist streams:', storageError);
    }
  }, [streams]);

  useEffect(() => {
    try {
      window.localStorage.setItem(GRID_STORAGE_KEY, String(columns));
    } catch (storageError) {
      console.warn('Failed to persist grid settings:', storageError);
    }
  }, [columns]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddStream = (event) => {
    event.preventDefault();
    const url = formValues.url.trim();
    const title = formValues.title.trim();

    if (!url) {
      setError('Please provide a video stream URL.');
      return;
    }

    const newStream = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title || `Stream ${streams.length + 1}`,
      url,
      aspectRatio: DEFAULT_ASPECT_RATIO
    };

    setStreams((prev) => [...prev, newStream]);
    setFormValues({ title: '', url: '' });
    setError('');
  };

  const handleRemoveStream = (id) => {
    setStreams((prev) => prev.filter((stream) => stream.id !== id));
    if (editingStreamId === id) {
      setEditingStreamId(null);
      setEditLabel('');
    }
    setDetectedRatios((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleClearAll = () => {
    setStreams([]);
    setError('');
    setEditingStreamId(null);
    setEditLabel('');
    setDetectedRatios({});
  };

  const handleColumnsChange = (event) => {
    const value = Number(event.target.value);
    if (!Number.isNaN(value)) {
      setColumns(Math.min(4, Math.max(1, value)));
    }
  };

  const reorderStreams = (fromIndex, toIndex) => {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
      return;
    }
    setStreams((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const handleDragStart = (index) => () => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index) => (event) => {
    event.preventDefault();
    if (index === draggedIndex) return;
    setTargetIndex(index);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (index) => (event) => {
    event.preventDefault();
    reorderStreams(draggedIndex, index);
    setDraggedIndex(null);
    setTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setTargetIndex(null);
  };

  const handleDropOnGridEnd = (event) => {
    event.preventDefault();
    if (draggedIndex === null) return;
    reorderStreams(draggedIndex, streams.length);
    setDraggedIndex(null);
    setTargetIndex(null);
  };

  const handleStartEdit = (stream) => {
    if (editingStreamId && editingStreamId !== stream.id) {
      return;
    }
    setEditingStreamId(stream.id);
    setEditLabel(stream.title);
  };

  const handleLabelDoubleClick = (stream) => {
    handleStartEdit(stream);
  };

  const handleEditInputChange = (event) => {
    setEditLabel(event.target.value);
  };

  const handleCancelEdit = () => {
    setEditingStreamId(null);
    setEditLabel('');
  };

  const handleSaveEdit = (event, streamId) => {
    event.preventDefault();
    const trimmed = editLabel.trim();
    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === streamId
          ? { ...stream, title: trimmed || stream.title }
          : stream
      )
    );
    handleCancelEdit();
  };

  const handleVideoMetadata = (streamId) => (event) => {
    const { videoWidth, videoHeight } = event.target;
    if (!videoWidth || !videoHeight) {
      return;
    }
    const ratio = videoWidth / videoHeight;
    const percent = (videoHeight / videoWidth) * 100;
    setDetectedRatios((prev) => {
      const existing = prev[streamId];
      if (existing && Math.abs(existing.ratio - ratio) < 0.01) {
        return prev;
      }
      return {
        ...prev,
        [streamId]: { ratio, percent }
      };
    });
  };

  const withFitParams = (url) => {
      try {
        const u = new URL(url);
        // Generic params some providers use (ignored if unsupported)
        u.searchParams.set('fit', 'contain');
        u.searchParams.set('letterbox', 'true');
        return u.toString();
      } catch {
        return url;
      }
  };

  const DIRECT_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

  const isDirectImageSource = (url) => {
      if (!url) return false;

      // If it looks like a typical MJPEG endpoint, treat as image too
      // (many MJPEG streams are just <img src="...">)
      const lower = url.toLowerCase();
      if (lower.includes('/stream/') || lower.includes('mjpeg') || lower.includes('snapshot')) {
        return true;
      }

      try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.toLowerCase();
        return DIRECT_IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
      } catch (error) {
        return DIRECT_IMAGE_EXTENSIONS.some((ext) => lower.includes(ext));
      }
  };

  const handleAspectRatioChange = (event, streamId) => {
    const value = event.target.value;
    if (!ASPECT_RATIO_OPTIONS.some((option) => option.key === value)) {
      return;
    }
    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === streamId
          ? { ...stream, aspectRatio: value }
          : stream
      )
    );
  };

  const renderStreamContent = (stream) => {
  // 1) Direct video files -> <video>
  if (isDirectVideoSource(stream.url)) {
    return (
      <video
        src={stream.url}
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={handleVideoMetadata(stream.id)}
      />
    );
  }

  // 2) Image / MJPEG-like streams -> <img> (BEST for your case)
  if (isDirectImageSource(stream.url)) {
    // cache-buster helps some "stream" endpoints refresh
    const src = `${stream.url}${stream.url.includes('?') ? '&' : '?'}cb=${Date.now()}`;

    return (
      <img
        src={src}
        alt={stream.title}
        loading="lazy"
        draggable={false}
      />
    );
  }

  // 3) Everything else -> <iframe>
  return (
    <iframe
      src={stream.url}
      title={`${stream.title} player`}
      loading="lazy"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation"
      style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
    />
  );
};


  return (
    <div className="video-stream-page">
      <div className="video-stream-header">
        <div>
          <h2>Video Stream Viewer</h2>
          <p>Collect your live feeds, keep them organized, and drag cards to change their order.</p>
        </div>
        {streams.length > 0 && (
          <button type="button" className="ghost-button" onClick={handleClearAll}>
            Clear All
          </button>
        )}
      </div>

      <section className="stream-form-section">
        <form className="stream-form" onSubmit={handleAddStream}>
          <div className="form-group">
            <label htmlFor="stream-title">Label</label>
            <input
              id="stream-title"
              name="title"
              type="text"
              placeholder="e.g., Warehouse Cam"
              value={formValues.title}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group url-group">
            <label htmlFor="stream-url">Stream URL</label>
            <input
              id="stream-url"
              name="url"
              type="url"
              placeholder="https://your-stream-provider.example/embed"
              value={formValues.url}
              onChange={handleInputChange}
              required
            />
            <small>Use embeddable URLs (iframe/video sources). HTTPS recommended.</small>
          </div>
          <button type="submit" className="primary-button">
            Add Stream
          </button>
        </form>
        <div className="viewer-settings">
          <label htmlFor="column-count">Cards per row</label>
          <select
            id="column-count"
            value={columns}
            onChange={handleColumnsChange}
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
        {error && <div className="video-stream-error">{error}</div>}
      </section>

      {streams.length === 0 ? (
        <div className="video-stream-empty">
          <p>No streams yet. Paste an embeddable link above to get started.</p>
        </div>
      ) : (
        <div
          className="video-stream-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(280px, 1fr))` }}
          onDragOver={handleDragOver}
          onDrop={handleDropOnGridEnd}
        >
          {streams.map((stream, index) => (
            <div
              key={stream.id}
              className={`video-card${index === draggedIndex ? ' dragging' : ''}${index === targetIndex ? ' drop-target' : ''}`}
              draggable
              onDragStart={handleDragStart(index)}
              onDragEnter={handleDragEnter(index)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop(index)}
            >
              <div className="video-card-header">
                <div className="video-card-title" onDoubleClick={() => handleLabelDoubleClick(stream)}>
                  <p className="video-card-label">Stream</p>
                  {editingStreamId === stream.id ? (
                    <form
                      className="inline-edit-form"
                      onSubmit={(event) => handleSaveEdit(event, stream.id)}
                    >
                      <input
                        type="text"
                        value={editLabel}
                        onChange={handleEditInputChange}
                        autoFocus
                      />
                      <div className="inline-edit-actions">
                        <button type="submit" className="primary-button mini">
                          Save
                        </button>
                        <button
                          type="button"
                          className="ghost-button mini"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <h3>{stream.title}</h3>
                  )}
                </div>
                <div className="video-card-actions">
                  <a
                    href={stream.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ghost-button"
                  >
                    Open
                  </a>
                  <button type="button" className="ghost-button" onClick={() => handleRemoveStream(stream.id)}>
                    Remove
                  </button>
                </div>
              </div>

              {(() => {
                const ratioConfig = getRatioConfig(stream, detectedRatios);
                const isFit = (stream.aspectRatio || DEFAULT_ASPECT_RATIO) === 'fit';

                const wrapperClass =
                  `video-frame-wrapper` +
                  (ratioConfig ? '' : ' auto-height') +
                  (isFit ? ' fit' : '');

                // IMPORTANT: use aspectRatio only (no paddingBottom hack)
                const wrapperStyle = ratioConfig
                  ? { aspectRatio: String(ratioConfig.ratio) }
                  : undefined;

                return (
                  <div className={wrapperClass} style={wrapperStyle}>
                    {renderStreamContent(stream)}
                  </div>
                );
              })()}

              <div className="video-card-footer">
                <span className="stream-url">{stream.url}</span>
                <div className="footer-controls">
                  <label>
                    Ratio:
                    <select
                      value={stream.aspectRatio || DEFAULT_ASPECT_RATIO}
                      onChange={(event) => handleAspectRatioChange(event, stream.id)}
                    >
                      {ASPECT_RATIO_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="drag-hint">Drag card to reorder</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const pluginMetadata = {
  name: 'Video Stream Viewer',
  icon: '🎥'
};

export default VideostreamviewerPage;
