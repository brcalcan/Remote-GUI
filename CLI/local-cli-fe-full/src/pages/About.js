import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLicenseInfo, getNodeVersion, getVersion } from '../services/api';
import '../styles/About.css';

const OPEN_SOURCE_URL = 'https://github.com/AnyLog-co/documentation/blob/master/license/Notice%20of%20Open%20Source%20Usage.md';
const DOCS_URL = 'https://github.com/AnyLog-co/documentation/blob/master/README.md';

const About = ({ node }) => {
  const [license, setLicense] = useState(null);
  const [nodeVersion, setNodeVersion] = useState(null);
  const [appVersion, setAppVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const results = await Promise.all([
        node ? getLicenseInfo({ connectInfo: node }) : Promise.resolve(null),
        node ? getNodeVersion({ connectInfo: node }) : Promise.resolve(null),
        getVersion(),
      ]);
      if (cancelled) return;
      setLicense(results[0]);
      setNodeVersion(results[1]);
      setAppVersion(results[2]);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [node]);

  const company = license?.company ?? '—';
  const expiration = license?.expiration ?? '—';

  const isLicenseActive = () => {
    if (!license?.expiration) return false;
    try {
      const exp = new Date(license.expiration);
      return exp >= new Date();
    } catch {
      return false;
    }
  };

  const licenseStatus = license
    ? (isLicenseActive() ? 'Active' : `Not Active (expired ${expiration})`)
    : '—';

  const codeVersion = nodeVersion ?? appVersion?.version ?? '—';

  if (loading) {
    return (
      <div className="about-page">
        <div className="about-content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="about-page">
      <div className="about-content">
        <h1>About</h1>

        <section className="about-section">
          <p><strong>Licensed to</strong> {company}</p>
          <p><strong>Valid through</strong> {expiration}</p>
          <p><strong>License Status:</strong> {licenseStatus}</p>
          <p><strong>Code Version:</strong> {codeVersion}</p>
          <p><strong>Remote-GUI version:</strong> {appVersion?.remote_gui_version ?? appVersion?.version ?? '—'}</p>
        </section>

        <section className="about-footer">
          <p>
            powered by{' '}
            <a href={OPEN_SOURCE_URL} target="_blank" rel="noopener noreferrer">
              open source
            </a>
          </p>
          <p>© 2026 AnyLog Inc.</p>
          <p>AnyLog and AnyLog GUI are proprietary software owned by AnyLog Inc.</p>
          <p>
            Documentation:{' '}
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
              {DOCS_URL}
            </a>
          </p>
        </section>

        <div className="about-back">
          <Link to="..">← Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default About;
