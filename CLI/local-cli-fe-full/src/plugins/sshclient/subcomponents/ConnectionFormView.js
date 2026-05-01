// Mini-form components

import '../styles/ConnectionFormView.css';

export const FormField = ({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  fullWidth = false,
  required = false,
  options = null,
  onFileChange = null,
  accept = null,
  disabled = false,
}) => {
  return (
    <div className={`form-field ${fullWidth ? 'full-width' : ''}`}>
      <label className="form-label">
        {label} {required && <span className="required">*</span>}
      </label>

      {options ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="form-input"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'file' ? (
        <input
          type="file"
          name={name}
          onChange={onFileChange}
          accept={accept}
          disabled={disabled}
          className="form-input file-input"
        />
      ) : (
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="form-input"
        />
      )}
    </div>
  );
};

export const FormHeader = ({ title, description }) => (
  <div className="form-header">
    <h3 className="form-title">{title}</h3>
    {description && <p className="form-description">{description}</p>}
  </div>
);

export const FormContainer = ({ children, style = {} }) => (
  <div className="form-container" style={style}>
    {children}
  </div>
);

export const FormGrid = ({ children }) => (
  <div className="form-grid">{children}</div>
);

export const FormButton = ({
  children,
  onClick,
  primary = true,
  fullWidth = false,
  type = 'button',
  disabled = false,
  style = {},
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`form-button ${
        primary ? 'primary' : 'secondary'
      } ${fullWidth ? 'full-width' : ''}`}
      style={style}
    >
      {children}
    </button>
  );
};
