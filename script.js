/**
 * =========================================
 * CORE LOGIC & INTERACTIVE SUITE
 * Portfolio: Thilok
 * =========================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeEngine();
  initMobileMenu();
  initCanvasParticles();
  initScrollEffects();
  initProjectFilters();
  initContactForm();
});

/* =========================================
   1. Theme Engine (Light/Dark Mode)
   ========================================= */
function initThemeEngine() {
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;

  // Retrieve previous settings or default to system preference
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

  if (savedTheme === 'light' || (!savedTheme && systemPrefersLight)) {
    body.setAttribute('data-theme', 'light');
  } else {
    body.removeAttribute('data-theme');
  }

  // Handle click toggling
  themeToggle.addEventListener('click', () => {
    const isLight = body.getAttribute('data-theme') === 'light';
    if (isLight) {
      body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      body.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
    // Re-draw background particle colors if needed
    updateParticleColors();
  });
}

/* =========================================
   2. Mobile Menu Mechanics
   ========================================= */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');
  const line1 = document.getElementById('line1');
  const line2 = document.getElementById('line2');
  const line3 = document.getElementById('line3');

  function toggleMenu() {
    const isOpen = navMenu.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', isOpen);

    if (isOpen) {
      // Animate hamburger to X
      line1.setAttribute('transform', 'rotate(45 12 12) translate(0, 0)');
      line1.setAttribute('y1', '12');
      line1.setAttribute('y2', '12');
      line2.setAttribute('opacity', '0');
      line3.setAttribute('transform', 'rotate(-45 12 12) translate(0, 0)');
      line3.setAttribute('y1', '12');
      line3.setAttribute('y2', '12');
    } else {
      // Reset X to hamburger
      line1.removeAttribute('transform');
      line1.setAttribute('y1', '6');
      line1.setAttribute('y2', '6');
      line2.setAttribute('opacity', '1');
      line3.removeAttribute('transform');
      line3.setAttribute('y1', '18');
      line3.setAttribute('y2', '18');
    }
  }

  toggleBtn.addEventListener('click', toggleMenu);

  // Close menu when a navigation item is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (navMenu.classList.contains('open')) {
        toggleMenu();
      }
    });
  });
}

/* =========================================
   3. Canvas Particle Network (Interactive)
   ========================================= */
let particleColor = 'rgba(99, 102, 241, 0.45)'; // Default theme-matching indigo
let connectionColor = 'rgba(6, 182, 212, 0.08)'; // Neon Cyan lines
let cursorConnectionColor = 'rgba(217, 70, 239, 0.15)'; // Magenta highlight

function updateParticleColors() {
  const isLight = document.body.getAttribute('data-theme') === 'light';
  if (isLight) {
    particleColor = 'rgba(79, 70, 229, 0.3)'; // Indigo
    connectionColor = 'rgba(79, 70, 229, 0.06)';
    cursorConnectionColor = 'rgba(192, 38, 211, 0.12)';
  } else {
    particleColor = 'rgba(99, 102, 241, 0.45)'; // Lighter indigo
    connectionColor = 'rgba(6, 182, 212, 0.08)';
    cursorConnectionColor = 'rgba(217, 70, 239, 0.15)';
  }
}

function initCanvasParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  updateParticleColors();

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const particles = [];
  const particleCount = Math.min(80, Math.floor((width * height) / 18000));
  const maxDistance = 120;

  const mouse = {
    x: null,
    y: null,
    radius: 180
  };

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.size = Math.random() * 2.5 + 1;
    }

    update() {
      // Boundary collision check
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      this.x += this.vx;
      this.y += this.vy;

      // Mouse attraction micro-animation
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x += (dx / dist) * force * 0.8;
          this.y += (dy / dist) * force * 0.8;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.fill();
    }
  }

  // Create particles
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Track mouse coordinates
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Track resize
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Draw particle connections
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = connectionColor;
          ctx.lineWidth = (1 - dist / maxDistance) * 0.8;
          ctx.stroke();
        }
      }

      // Draw cursor connections
      if (mouse.x !== null && mouse.y !== null) {
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = cursorConnectionColor;
          ctx.lineWidth = (1 - dist / mouse.radius) * 0.6;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
}

/* =========================================
   4. Scroll Effects & Section Tracker
   ========================================= */
function initScrollEffects() {
  const progressBar = document.getElementById('progress-bar');
  const scrollTopBtn = document.getElementById('scroll-top');
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');

  // Year dynamic filler
  const yearElement = document.getElementById('current-year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Scroll handler for progress bar and scroll-to-top button
  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY;
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    
    // Page progress calculation
    const progressLimit = docHeight - winHeight;
    const progressPercent = progressLimit > 0 ? (scrollPos / progressLimit) * 100 : 0;
    progressBar.style.width = `${progressPercent}%`;

    // Scroll to top button visibility threshold
    if (scrollPos > 400) {
      scrollTopBtn.style.opacity = '1';
      scrollTopBtn.style.pointerEvents = 'all';
      scrollTopBtn.style.transform = 'translateY(0)';
    } else {
      scrollTopBtn.style.opacity = '0';
      scrollTopBtn.style.pointerEvents = 'none';
      scrollTopBtn.style.transform = 'translateY(10px)';
    }
  });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // IntersectionObserver to highlight currently active nav link
  const observerOptions = {
    root: null,
    rootMargin: '-30% 0px -40% 0px', // Center active range
    threshold: 0
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));
}

/* =========================================
   5. Portfolio Project Filter System
   ========================================= */
function initProjectFilters() {
  const filters = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filters.forEach(filter => {
    filter.addEventListener('click', () => {
      // Toggle active states
      filters.forEach(f => f.classList.remove('active'));
      filter.classList.add('active');

      const targetFilter = filter.getAttribute('data-filter');

      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');

        if (targetFilter === 'all' || category === targetFilter) {
          card.classList.remove('hide');
          card.classList.add('show');
          card.style.display = 'flex'; // Keep flex alignment
        } else {
          card.classList.remove('show');
          card.classList.add('hide');
          // Delay display setting to allow fade animations to complete
          setTimeout(() => {
            if (card.classList.contains('hide')) {
              card.style.display = 'none';
            }
          }, 350);
        }
      });
    });
  });
}

/* =========================================
   6. Contact Form validation & animations
   ========================================= */
function initContactForm() {
  const form = document.getElementById('contact-form');
  const successOverlay = document.getElementById('form-success');
  const resetBtn = document.getElementById('form-reset-btn');
  const submitBtn = document.getElementById('form-submit-btn');

  if (!form || !successOverlay) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    // Visual button loading feedback
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = `
      Transmitting...
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="float" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
      </svg>
    `;

    // Simulate server network dispatch
    setTimeout(() => {
      // Hide form contents, display success overlay
      form.style.display = 'none';
      successOverlay.style.display = 'flex';
      
      // Reset form variables
      form.reset();
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.innerHTML = originalText;
    }, 1800);
  });

  resetBtn.addEventListener('click', () => {
    // Reset layout display states
    successOverlay.style.display = 'none';
    form.style.display = 'block';
  });
}

// Add simple CSS spin keyframe inject for button load state
const style = document.createElement('style');
style.innerHTML = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
