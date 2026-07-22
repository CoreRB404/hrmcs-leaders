import { useState } from 'react';

function RegisterForm({ registerForm, setRegisterForm, registerHospital, generatedReviewerCredentials }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={registerHospital} className="form-grid" id="register-form">
      {generatedReviewerCredentials ? (
        <div className="profile-card" style={{ borderStyle: 'dashed' }}>
          <div className="profile-info">
            <h3>Generated reviewer credentials</h3>
            <p className="subhead">Save these credentials. They activate when an admin approves the hospital.</p>
            <div className="profile-meta" style={{ display: 'grid', gap: 6 }}>
              <span><strong>Doctor:</strong> {generatedReviewerCredentials.doctor.email} / {generatedReviewerCredentials.doctor.password}</span>
              <span><strong>Pharmacist:</strong> {generatedReviewerCredentials.pharmacist.email} / {generatedReviewerCredentials.pharmacist.password}</span>
            </div>
          </div>
        </div>
      ) : null}
      <div className="form-grid two-col-form">
        <div className="field">
          <label htmlFor="reg-name">Hospital name</label>
          <input
            id="reg-name"
            value={registerForm.name}
            onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
            placeholder="e.g. Metro General Hospital"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reg-location">Location</label>
          <input
            id="reg-location"
            value={registerForm.location}
            onChange={(e) => setRegisterForm({ ...registerForm, location: e.target.value })}
            placeholder="City or district"
            required
          />
        </div>
      </div>
    
      <div className="field">
        <label htmlFor="reg-email">Email address</label>
        <div className="field-with-icon">
          <span className="field-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </span>
          <input
            id="reg-email"
            value={registerForm.email}
            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
            placeholder="admin@hospital.org"
            required
            autoComplete="email"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="reg-password">Password</label>
        <div className="field-with-icon">
          <span className="field-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </span>
          <input
            id="reg-password"
            type={showPassword ? 'text' : 'password'}
            value={registerForm.password}
            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
            placeholder="Create a secure password"
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
          </button>
        </div>
      </div>
      <div className="form-grid two-col-form">
        <div className="field">
          <label htmlFor="reg-visibility">Visibility</label>
          <select
            id="reg-visibility"
            value={registerForm.visibility}
            onChange={(e) => setRegisterForm({ ...registerForm, visibility: e.target.value })}
          >
            <option value="Public">Public</option>
            <option value="Private">Private</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="reg-type">Hospital type</label>
          <select
            id="reg-type"
            value={registerForm.type}
            onChange={(e) => setRegisterForm({ ...registerForm, type: e.target.value })}
          >
            <option value="General">General</option>
            <option value="Specialist">Specialist</option>
            <option value="Emergency">Emergency</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="reg-emergency-status">Emergency status</label>
        <select
          id="reg-emergency-status"
          value={registerForm.emergencyStatus}
          onChange={(e) => setRegisterForm({ ...registerForm, emergencyStatus: e.target.value })}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </div>
      <button type="submit" id="register-submit">Register hospital</button>
    </form>
  );
}

export default RegisterForm;
