import { useState, useRef, useEffect } from 'react';

export default function AcnFormWidget({ payload, onSubmit }) {
  const { title, subtitle, fields = [], cta_label = 'Submit', cta_value_prefix = '' } = payload;
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    setTimeout(() => firstRef.current?.focus(), 100);
  }, []);

  const validate = () => {
    const newErrors = {};
    fields.forEach((f) => {
      const val = (values[f.field_id] || '').trim();
      if (f.required && !val) {
        newErrors[f.field_id] = f.validation?.error_message || 'This field is required.';
        return;
      }
      if (f.validation?.pattern && val) {
        const re = new RegExp(f.validation.pattern);
        if (!re.test(val)) {
          newErrors[f.field_id] = f.validation.error_message || 'Invalid input.';
        }
      }
      if (f.validation?.min_length && val.length < f.validation.min_length) {
        newErrors[f.field_id] = f.validation.error_message || 'Too short.';
      }
    });
    return newErrors;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitted(true);
    // Build submission string: prefix:field1value (single field) or prefix:field1=val&field2=val
    const parts = fields.map((f) => values[f.field_id] || '');
    const value = cta_value_prefix
      ? `${cta_value_prefix}:${parts.join('&')}`
      : parts.join(' ');
    onSubmit(value);
  };

  return (
    <div className="acn-form-widget">
      {title && <div className="acn-form-title">{title}</div>}
      {subtitle && <div className="acn-form-subtitle">{subtitle}</div>}
      <div className="acn-form-fields">
        {fields.map((f, i) => (
          <div key={f.field_id} className="acn-form-field">
            <label className="acn-form-label">
              {f.label}{f.required && <span className="acn-form-req"> *</span>}
            </label>
            <input
              ref={i === 0 ? firstRef : null}
              className={`acn-form-input-el${errors[f.field_id] ? ' error' : ''}`}
              type={f.type || 'text'}
              placeholder={f.placeholder || ''}
              value={values[f.field_id] || ''}
              disabled={submitted}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, [f.field_id]: e.target.value }));
                if (errors[f.field_id]) setErrors((prev) => ({ ...prev, [f.field_id]: '' }));
              }}
              onKeyDown={(e) => e.key === 'Enter' && !submitted && handleSubmit()}
            />
            {f.hint && !errors[f.field_id] && (
              <span className="acn-form-hint">{f.hint}</span>
            )}
            {errors[f.field_id] && (
              <span className="acn-form-error">{errors[f.field_id]}</span>
            )}
          </div>
        ))}
      </div>
      <button
        className={`acn-form-cta${submitted ? ' submitted' : ''}`}
        onClick={handleSubmit}
        disabled={submitted}
      >
        {submitted ? '✓ Submitted' : cta_label}
      </button>
    </div>
  );
}
