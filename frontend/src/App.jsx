import { useState } from "react";

import {
  ArrowRight,
  ShieldCheck,
  Mic,
  MapPin,
  Search,
  Clock,
  IndianRupee,
  Menu,
  X,
  Sprout,
  Handshake,
  Headphones,
  Users,
} from "lucide-react";

const jobs = [
  {
    title: "Electrician",
    location: "Dwarka, New Delhi",
    salary: "₹800 – ₹1,200",
    type: "Daily work",
    category: "Electrical",
  },
  {
    title: "Plumber",
    location: "Uttam Nagar, New Delhi",
    salary: "₹700 – ₹1,000",
    type: "Full-time",
    category: "Plumbing",
  },
  {
    title: "Carpenter",
    location: "Janakpuri, New Delhi",
    salary: "₹900 – ₹1,500",
    type: "Contract",
    category: "Carpentry",
  },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState("EN");
  const [listening, setListening] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const startVoiceAssistant = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice recognition is not supported. Please try Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = language === "HI" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);

    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript;

      const message =
        language === "HI"
          ? `Aapne kaha: ${command}. Hum aapki madad karenge.`
          : `You said: ${command}. We will help you.`;

      const speech = new SpeechSynthesisUtterance(message);
      speech.lang = language === "HI" ? "hi-IN" : "en-IN";

      window.speechSynthesis.speak(speech);
    };

    recognition.onerror = () => {
      setListening(false);
      alert("Voice recognition could not start. Please try again.");
    };

    recognition.start();
  };

  return (
    <div className="app">

      {/* NAVBAR */}

      <header className="navbar">
        <nav className="nav-container">

          <a href="#home" className="brand" onClick={closeMenu}>
            <div className="brand-icon">
              <Sprout size={28} />
            </div>

            <div className="brand-text">
              <span className="brand-name">KaamConnect</span>
              <span className="brand-tagline">WORK WITH DIGNITY</span>
            </div>
          </a>

          <div className={`nav-links ${menuOpen ? "show-menu" : ""}`}>
            <a href="#home" onClick={closeMenu}>Home</a>
            <a href="#jobs" onClick={closeMenu}>Find Work</a>
            <a href="#employers" onClick={closeMenu}>Hire Workers</a>
            <a href="#how-it-works" onClick={closeMenu}>How It Works</a>
            <a href="#trust" onClick={closeMenu}>Trust & Safety</a>
          </div>

          <div className="nav-actions">
            <button
              className="language-btn"
              onClick={() => setLanguage(language === "EN" ? "HI" : "EN")}
            >
              {language === "EN" ? "हिंदी" : "English"}
            </button>

            <button className="login-btn">
              Login
            </button>

            <button className="nav-register">
              Get Started
            </button>
          </div>

          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={25} /> : <Menu size={25} />}
          </button>

        </nav>
      </header>

      {/* HERO */}

      <section className="hero" id="home">
        <div className="hero-container">

          <div className="hero-content">

            <div className="hero-label">
              <Sprout size={17} />
              <span>OPPORTUNITIES FOR EVERYONE</span>
            </div>

            <h1>
              Skills deserve work.
              <br />
              <span>Every worker deserves</span>
              <br />
              an opportunity.
            </h1>

            <p className="hero-description">
              Connecting hardworking people with trusted employers
              in their neighbourhood. Find work, hire talent and
              build a better tomorrow.
            </p>

            <div className="hero-buttons">
              <a href="#jobs" className="primary-btn">
                Find Work <ArrowRight size={18} />
              </a>

              <a href="#employers" className="secondary-btn">
                Hire Workers <Users size={18} />
              </a>
            </div>

            <div className="hero-trust">
              <ShieldCheck size={19} />
              <span>Built around trust, dignity and opportunity.</span>
            </div>

          </div>

        </div>
      </section>

      {/* JOB SECTION */}

      <section className="jobs-section" id="jobs">
        <div className="section-container">

          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR NEXT OPPORTUNITY</span>
              <h2>Work that comes closer to you.</h2>
              <p>Explore opportunities based on your skills and location.</p>
            </div>

            <a href="#jobs" className="text-link">
              Explore all jobs <ArrowRight size={17} />
            </a>
          </div>

          <div className="job-search">

            <div className="search-field">
              <Search size={20} />
              <input
                type="text"
                placeholder="What work are you looking for?"
                aria-label="Search for work"
              />
            </div>

            <div className="search-field">
              <MapPin size={20} />
              <input
                type="text"
                placeholder="Enter your location"
                aria-label="Enter your location"
              />
            </div>

            <button className="search-button">
              Search Jobs
            </button>

          </div>

          <div className="job-grid">
            {jobs.map((job) => (
              <article className="job-card" key={job.title}>

                <div className="job-card-top">
                  <span className="job-category">
                    {job.category}
                  </span>

                  <span className="job-status">
                    Sample listing
                  </span>
                </div>

                <h3>{job.title}</h3>

                <div className="job-location">
                  <MapPin size={16} />
                  {job.location}
                </div>

                <div className="job-details">
                  <span>
                    <IndianRupee size={15} />
                    {job.salary}
                  </span>

                  <span>
                    <Clock size={15} />
                    {job.type}
                  </span>
                </div>

                <button className="job-apply">
                  View Opportunity <ArrowRight size={16} />
                </button>

              </article>
            ))}
          </div>

          <p className="demo-note">
            These are sample listings for demonstration purposes.
            They are not confirmed vacancies.
          </p>

        </div>
      </section>

      {/* EMPLOYER SECTION */}

      <section className="employer-section" id="employers">
        <div className="section-container employer-content">

          <div className="employer-text">
            <span className="eyebrow">FOR EMPLOYERS</span>

            <h2>
              Good work starts with
              <br />
              the right people.
            </h2>

            <p>
              Find skilled, hardworking people near your location.
              Connect with local talent and grow your work with confidence.
            </p>

            <a href="#how-it-works" className="employer-button">
              Start Hiring <ArrowRight size={18} />
            </a>
          </div>

          <div className="employer-visual">
            <div className="employer-illustration">
              <Handshake size={65} strokeWidth={1.4} />

              <h3>Local talent. Real opportunities.</h3>

              <p>Building stronger communities together.</p>
            </div>
          </div>

        </div>
      </section>

      {/* TRUST SECTION */}

      <section className="trust-section" id="trust">
        <div className="section-container">

          <div className="trust-heading">
            <span className="eyebrow">TRUST IS OUR FOUNDATION</span>

            <h2>
              Work with confidence.
              <br />
              Connect with trust.
            </h2>

            <p>
              Safety should never be optional. We are building
              protection into every step of the employment journey.
            </p>
          </div>

          <div className="trust-grid">

            <div className="trust-card">
              <div className="trust-card-icon">
                <ShieldCheck size={27} />
              </div>

              <h3>Profile Verification</h3>

              <p>
                Verification checks to help identify genuine
                workers and employers.
              </p>
            </div>

            <div className="trust-card">
              <div className="trust-card-icon terra-icon">
                <IndianRupee size={27} />
              </div>

              <h3>Payment Protection</h3>

              <p>
                Transparent payment records and a structured
                dispute-support process.
              </p>
            </div>

            <div className="trust-card">
              <div className="trust-card-icon">
                <Headphones size={27} />
              </div>

              <h3>Voice Accessibility</h3>

              <p>
                Simple voice-based navigation for people who
                prefer speaking over reading.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}

      <section className="how-section" id="how-it-works">
        <div className="section-container">

          <div className="how-heading">
            <span className="eyebrow">SIMPLE. HUMAN. ACCESSIBLE.</span>
            <h2>Getting started is easy.</h2>
          </div>

          <div className="steps-grid">

            <div className="step">
              <span>01</span>
              <h3>Create your profile</h3>
              <p>Share your basic details, skills and experience.</p>
            </div>

            <div className="step">
              <span>02</span>
              <h3>Connect with people</h3>
              <p>Find nearby jobs or discover suitable workers.</p>
            </div>

            <div className="step">
              <span>03</span>
              <h3>Work with confidence</h3>
              <p>Keep track of opportunities and payment records.</p>
            </div>

          </div>
        </div>
      </section>

      {/* FINAL CTA */}

      <section className="final-cta">
        <div className="section-container final-cta-content">

          <div>
            <span>EVERY SKILL HAS VALUE</span>
            <h2>Let's build better opportunities, together.</h2>
          </div>

          <a href="#home" className="cta-button">
            Get Started <ArrowRight size={18} />
          </a>

        </div>
      </section>

      {/* FOOTER */}

      <footer className="footer">
        <div className="section-container">

          <div className="footer-main">

            <div className="footer-brand">
              <div className="footer-logo">
                <Sprout size={25} />
                <span>KaamConnect</span>
              </div>

              <p>
                Connecting skills with opportunities.
                Building trust, one connection at a time.
              </p>
            </div>

            <div className="footer-links">
              <h4>Explore</h4>
              <a href="#jobs">Find Work</a>
              <a href="#employers">Hire Workers</a>
              <a href="#how-it-works">How It Works</a>
            </div>

            <div className="footer-links">
              <h4>Our Values</h4>
              <a href="#trust">Trust & Safety</a>
              <a href="#home">Accessibility</a>
              <a href="#home">About Us</a>
            </div>

          </div>

          <div className="footer-bottom">
            <p>© 2026 KaamConnect. All rights reserved.</p>
            <p>Skills Deserve Work. Every Worker Deserves Respect.</p>
          </div>

        </div>
      </footer>

      {/* FLOATING VOICE BUTTON */}

      <button
        className={`floating-voice-btn ${listening ? "listening" : ""}`}
        onClick={startVoiceAssistant}
        aria-label="Talk to KaamConnect"
      >
        <Mic size={25} />

        <span>
          {listening ? "Listening..." : "Talk to KaamConnect"}
        </span>
      </button>

    </div>
  );
}

export default App;