// app.js - Main Application Logic for AI Interview Coach

// Constants
const GEMINI_MODEL = 'gemini-2.5-flash';

// Application State
const state = {
  currentView: 'dashboard',
  apiKey: localStorage.getItem('interview_coach_api_key') || '',
  history: JSON.parse(localStorage.getItem('interview_coach_history')) || [],
  voiceEnabled: JSON.parse(localStorage.getItem('interview_coach_voice_enabled') !== 'false'),
  selectedVoice: localStorage.getItem('interview_coach_selected_voice') || '',
  activeSession: {
    role: null,
    roleTitle: '',
    experience: 'mid',
    jobDescription: '',
    resumeText: '',
    questions: [],
    answers: [],
    feedbacks: [],
    currentQuestionIndex: 0,
    startTime: null,
    interviewerState: 'idle' // idle, speaking, listening, thinking
  },
  recognition: null,
  isRecording: false,
  chartInstance: null
};

// Speech Recognition Initialization
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech API (Speech Recognition) is not supported in this browser.");
    return null;
  }
  
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  recognition.onstart = () => {
    state.isRecording = true;
    updateMicButtonUI();
    setInterviewerState('listening');
  };
  
  recognition.onend = () => {
    state.isRecording = false;
    updateMicButtonUI();
    if (state.activeSession.interviewerState === 'listening') {
      setInterviewerState('idle');
    }
  };
  
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    const textarea = document.getElementById('user-response');
    if (textarea && finalTranscript) {
      textarea.value = (textarea.value + ' ' + finalTranscript).trim();
    }
    
    // Animate audio waveform bar heights based on speech
    animateWaveform();
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
  };
  
  return recognition;
}

// Speech Synthesis / Text to Speech (TTS)
function speak(text, callback) {
  if (!state.voiceEnabled) {
    if (callback) callback();
    return;
  }
  
  // Cancel current speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set voice
  if (state.selectedVoice) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === state.selectedVoice);
    if (voice) utterance.voice = voice;
  }
  
  utterance.onstart = () => {
    setInterviewerState('speaking');
  };
  
  utterance.onend = () => {
    setInterviewerState('idle');
    if (callback) callback();
  };
  
  utterance.onerror = (e) => {
    console.error("Speech synthesis error:", e);
    setInterviewerState('idle');
    if (callback) callback();
  };
  
  window.speechSynthesis.speak(utterance);
}

// Interviewer animation states
function setInterviewerState(interviewerState) {
  state.activeSession.interviewerState = interviewerState;
  const avatarContainer = document.getElementById('interviewer-avatar');
  const badge = document.getElementById('interviewer-status-badge');
  const waveform = document.getElementById('audio-waveform');
  
  if (!avatarContainer || !badge) return;
  
  // Clear classes
  avatarContainer.className = 'avatar-container';
  badge.className = 'status-badge';
  if (waveform) waveform.className = 'audio-visualization';
  
  switch(interviewerState) {
    case 'speaking':
      avatarContainer.classList.add('speaking');
      badge.classList.add('speaking');
      badge.textContent = 'Speaking...';
      if (waveform) waveform.classList.add('active');
      break;
    case 'listening':
      avatarContainer.classList.add('listening');
      badge.classList.add('listening');
      badge.textContent = 'Listening...';
      if (waveform) waveform.classList.add('active');
      break;
    case 'thinking':
      avatarContainer.classList.add('thinking');
      badge.classList.add('thinking');
      badge.textContent = 'Analyzing...';
      break;
    case 'idle':
    default:
      badge.classList.add('idle');
      badge.textContent = 'Idle';
      break;
  }
}

// Waveform helper animation
function animateWaveform() {
  const bars = document.querySelectorAll('.audio-bar');
  bars.forEach(bar => {
    const height = Math.floor(Math.random() * 30) + 6;
    bar.style.height = `${height}px`;
  });
}

// Switch between SPA views
function showView(viewId) {
  state.currentView = viewId;
  
  // Toggle active views
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });
  
  const activeSection = document.getElementById(viewId);
  if (activeSection) {
    activeSection.classList.add('active');
  }
  
  // Toggle sidebar active links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    }
  });
  
  // Run view specific initializers
  if (viewId === 'dashboard') {
    renderDashboard();
  } else if (viewId === 'history') {
    renderHistory();
  } else if (viewId === 'settings') {
    renderSettings();
  }
}

// View Initializers: Dashboard
function renderDashboard() {
  // Update stats
  const totalInterviews = state.history.length;
  document.getElementById('stat-total-interviews').textContent = totalInterviews;
  
  if (totalInterviews > 0) {
    const avgScore = Math.round(state.history.reduce((sum, item) => sum + item.score, 0) / totalInterviews);
    document.getElementById('stat-avg-score').textContent = `${avgScore}%`;
    
    // Strengths and weaknesses extraction
    const allStrengths = [];
    const allWeaknesses = [];
    state.history.forEach(session => {
      if (session.strengths) allStrengths.push(...session.strengths);
      if (session.improvements) allWeaknesses.push(...session.improvements);
    });
    
    // Get unique/top items
    const topStrength = allStrengths.length > 0 ? getMostFrequent(allStrengths) : 'Communication';
    const topWeakness = allWeaknesses.length > 0 ? getMostFrequent(allWeaknesses) : 'Technical Depth';
    
    document.getElementById('stat-top-strength').textContent = truncateText(topStrength, 22);
    document.getElementById('stat-top-weakness').textContent = truncateText(topWeakness, 22);
  } else {
    document.getElementById('stat-avg-score').textContent = 'N/A';
    document.getElementById('stat-top-strength').textContent = 'N/A';
    document.getElementById('stat-top-weakness').textContent = 'N/A';
  }
  
  // Render Chart
  renderScoreChart();
  
  // Handle API Key Warning Banner
  const warningBanner = document.getElementById('api-warning');
  if (state.apiKey) {
    warningBanner.style.display = 'none';
  } else {
    warningBanner.style.display = 'flex';
  }
}

function getMostFrequent(arr) {
  const hash = {};
  arr.forEach(val => { hash[val] = (hash[val] || 0) + 1; });
  return Object.keys(hash).reduce((a, b) => hash[a] > hash[b] ? a : b);
}

function truncateText(text, length) {
  return text.length > length ? text.substring(0, length - 3) + '...' : text;
}

// Draw readiness score chart using Chart.js
function renderScoreChart() {
  const ctx = document.getElementById('scoreChart');
  if (!ctx) return;
  
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }
  
  const labels = state.history.map((item, idx) => `Session ${idx + 1}`);
  const data = state.history.map(item => item.score);
  
  // Fallback defaults if history is empty
  const chartLabels = labels.length > 0 ? labels : ['No Sessions Yet'];
  const chartData = data.length > 0 ? data : [0];
  
  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Interview Readiness Score (%)',
        data: chartData,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#a855f7',
        pointBorderColor: '#fff',
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94a3b8'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#94a3b8'
          }
        }
      }
    }
  });
}

// View Initializers: History
function renderHistory() {
  const container = document.getElementById('history-list-container');
  if (!container) return;
  
  if (state.history.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
        <p>No interview history found. Complete your first session to see results!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.history.map((session, index) => `
    <div class="history-item">
      <div class="history-meta">
        <span class="history-role">${session.roleTitle}</span>
        <span class="history-date">${new Date(session.date).toLocaleString()}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 1.5rem;">
        <span class="history-score">${session.score}%</span>
        <button class="btn btn-secondary" onclick="viewHistoryReport(${index})">View Report</button>
      </div>
    </div>
  `).join('');
}

function viewHistoryReport(index) {
  const report = state.history[index];
  renderReportView(report);
}

// View Initializers: Settings
function renderSettings() {
  const apiKeyInput = document.getElementById('settings-api-key');
  const voiceToggle = document.getElementById('settings-voice-enabled');
  const voiceSelect = document.getElementById('settings-voice-select');
  
  if (apiKeyInput) apiKeyInput.value = state.apiKey;
  if (voiceToggle) voiceToggle.checked = state.voiceEnabled;
  
  // Load synthesis voices
  if (voiceSelect && window.speechSynthesis) {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceSelect.innerHTML = voices.map(voice => `
        <option value="${voice.name}" ${state.selectedVoice === voice.name ? 'selected' : ''}>
          ${voice.name} (${voice.lang})
        </option>
      `).join('');
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }
}

// Save Settings
function saveSettings(event) {
  if (event) event.preventDefault();
  
  const apiKey = document.getElementById('settings-api-key').value.trim();
  const voiceEnabled = document.getElementById('settings-voice-enabled').checked;
  const voiceSelect = document.getElementById('settings-voice-select').value;
  
  state.apiKey = apiKey;
  state.voiceEnabled = voiceEnabled;
  state.selectedVoice = voiceSelect;
  
  localStorage.setItem('interview_coach_api_key', apiKey);
  localStorage.setItem('interview_coach_voice_enabled', voiceEnabled);
  localStorage.setItem('interview_coach_selected_voice', voiceSelect);
  
  alert("Settings saved successfully!");
  showView('dashboard');
}

// API Call Handler for Google Gemini API
async function callGemini(prompt, systemInstruction = '') {
  if (!state.apiKey) {
    throw new Error("API Key is missing. Please add your Gemini API Key in the Settings page.");
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${state.apiKey}`;
  
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };
  
  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || "Failed to communicate with Gemini API");
  }
  
  const data = await response.json();
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

// Interview Session Workflow: Initiation
function startSetup() {
  showView('interview-setup');
  
  // Populate dropdown with custom preset roles
  const select = document.getElementById('setup-role');
  if (select) {
    select.innerHTML = Object.entries(window.PRESET_ROLES).map(([key, role]) => `
      <option value="${key}">${role.title}</option>
    `).join('');
  }
}

async function startInterview(event) {
  if (event) event.preventDefault();
  
  const roleKey = document.getElementById('setup-role').value;
  const experience = document.getElementById('setup-experience').value;
  const jdText = document.getElementById('setup-jd').value.trim();
  const resumeText = document.getElementById('setup-resume').value.trim();
  
  // Reset active session state
  state.activeSession = {
    role: roleKey,
    roleTitle: window.PRESET_ROLES[roleKey].title,
    experience: experience,
    jobDescription: jdText,
    resumeText: resumeText,
    questions: [],
    answers: [],
    feedbacks: [],
    currentQuestionIndex: 0,
    startTime: new Date(),
    interviewerState: 'idle'
  };
  
  setInterviewerState('thinking');
  showView('interview-room');
  
  try {
    // Generate/Load questions
    if (state.apiKey) {
      // Prompt Gemini to generate specific tailored questions
      const prompt = `Generate a list of exactly 5 interview questions for a ${window.PRESET_ROLES[roleKey].title} position at the ${experience} level. 
      ${jdText ? `Here is the Job Description: ${jdText}` : ''}
      ${resumeText ? `Here is the Candidate's Resume: ${resumeText}` : ''}
      
      Requirements:
      - Return a JSON object with a single key 'questions' containing an array of 5 strings.
      - The questions must range from technical skill evaluation, behavioral questions (STAR format), to situational logic.
      - Ensure they are realistic, specific, and professional.`;
      
      const response = await callGemini(prompt, "You are a professional hiring manager and interview coach.");
      state.activeSession.questions = response.questions;
    } else {
      // Load preset mock questions
      state.activeSession.questions = [...window.PRESET_ROLES[roleKey].questions];
    }
    
    // Start with the first question
    presentQuestion(0);
    
  } catch (error) {
    alert("Error starting interview: " + error.message);
    showView('interview-setup');
  }
}

// Present current question to the user
function presentQuestion(index) {
  state.activeSession.currentQuestionIndex = index;
  
  const qNum = document.getElementById('question-number');
  const qText = document.getElementById('question-text');
  const textarea = document.getElementById('user-response');
  const submitBtn = document.getElementById('next-question-btn');
  
  if (qNum) qNum.textContent = `Question ${index + 1} of ${state.activeSession.questions.length}`;
  if (qText) qText.textContent = state.activeSession.questions[index];
  if (textarea) textarea.value = '';
  
  if (submitBtn) {
    if (index === state.activeSession.questions.length - 1) {
      submitBtn.textContent = 'Finish & Evaluate';
    } else {
      submitBtn.textContent = 'Next Question';
    }
  }
  
  // Read aloud the question using text-to-speech
  speak(state.activeSession.questions[index]);
}

// Microphone Control
function toggleRecording() {
  if (!state.recognition) {
    state.recognition = initSpeechRecognition();
  }
  
  if (!state.recognition) {
    alert("Microphone recognition is not available or supported in this browser.");
    return;
  }
  
  if (state.isRecording) {
    stopRecording();
  } else {
    try {
      state.recognition.start();
    } catch(e) {
      console.error(e);
      // Restart if failed
      state.recognition = initSpeechRecognition();
      state.recognition.start();
    }
  }
}

function stopRecording() {
  if (state.recognition && state.isRecording) {
    state.recognition.stop();
  }
}

function updateMicButtonUI() {
  const micBtn = document.getElementById('mic-button');
  if (!micBtn) return;
  
  if (state.isRecording) {
    micBtn.classList.add('recording');
  } else {
    micBtn.classList.remove('recording');
  }
}

// Voice Toggle Output
function toggleMute() {
  state.voiceEnabled = !state.voiceEnabled;
  localStorage.setItem('interview_coach_voice_enabled', state.voiceEnabled);
  
  const speakerBtn = document.getElementById('speaker-button');
  if (speakerBtn) {
    if (state.voiceEnabled) {
      speakerBtn.classList.remove('muted');
      speakerBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      `;
    } else {
      speakerBtn.classList.add('muted');
      speakerBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      `;
      // Stop reading aloud instantly
      window.speechSynthesis.cancel();
      setInterviewerState('idle');
    }
  }
}

// Next Question / Submission Action
async function submitAnswer() {
  const textarea = document.getElementById('user-response');
  const answer = textarea ? textarea.value.trim() : '';
  
  stopRecording();
  
  state.activeSession.answers.push(answer);
  
  // Show thinking state
  setInterviewerState('thinking');
  
  try {
    const qIndex = state.activeSession.currentQuestionIndex;
    const question = state.activeSession.questions[qIndex];
    
    // Get evaluation feedback for this answer
    let feedback;
    if (state.apiKey) {
      const evalPrompt = `Evaluate the candidate response to the interview question:
      Question: "${question}"
      Candidate Answer: "${answer}"
      Job Role: "${state.activeSession.roleTitle}"
      Experience Level: "${state.activeSession.experience}"
      
      Respond with a JSON object conforming exactly to this schema:
      {
        "overallScore": number (0-100 score based on correctness, structure, relevance),
        "categories": {
          "communication": number (0-100),
          "relevance": number (0-100),
          "technical": number (0-100),
          "confidence": number (0-100)
        },
        "strengths": string[] (list of 2 positive things in the response),
        "improvements": string[] (list of 2 constructive improvement points),
        "idealResponse": string (a comprehensive ideal answer layout/guidelines for this question)
      }`;
      
      feedback = await callGemini(evalPrompt, "You are a professional evaluator analyzing interview answers.");
    } else {
      feedback = window.getSimulatedFeedback(question, answer, state.activeSession.roleTitle);
    }
    
    state.activeSession.feedbacks.push(feedback);
    
    // Navigate or Proceed
    const nextIndex = qIndex + 1;
    if (nextIndex < state.activeSession.questions.length) {
      presentQuestion(nextIndex);
    } else {
      // Completed all questions
      await finishInterview();
    }
  } catch (error) {
    alert("Evaluation error: " + error.message);
    setInterviewerState('idle');
  }
}

// Finish mock interview and compile complete report
async function finishInterview() {
  setInterviewerState('thinking');
  
  // Calculate average scores from category feedbacks
  const feedbacks = state.activeSession.feedbacks;
  const count = feedbacks.length;
  
  const overallScore = Math.round(feedbacks.reduce((sum, f) => sum + f.overallScore, 0) / count);
  const communication = Math.round(feedbacks.reduce((sum, f) => sum + f.categories.communication, 0) / count);
  const relevance = Math.round(feedbacks.reduce((sum, f) => sum + f.categories.relevance, 0) / count);
  const technical = Math.round(feedbacks.reduce((sum, f) => sum + f.categories.technical, 0) / count);
  const confidence = Math.round(feedbacks.reduce((sum, f) => sum + f.categories.confidence, 0) / count);
  
  // Gather overall aggregated strengths & weaknesses
  const aggStrengths = [...new Set(feedbacks.flatMap(f => f.strengths))].slice(0, 3);
  const aggImprovements = [...new Set(feedbacks.flatMap(f => f.improvements))].slice(0, 3);
  
  const finalReport = {
    roleTitle: state.activeSession.roleTitle,
    experience: state.activeSession.experience,
    date: new Date().toISOString(),
    score: overallScore,
    categories: { communication, relevance, technical, confidence },
    strengths: aggStrengths,
    improvements: aggImprovements,
    sessionQA: state.activeSession.questions.map((q, idx) => ({
      question: q,
      answer: state.activeSession.answers[idx],
      feedbackText: state.activeSession.feedbacks[idx].strengths.concat(state.activeSession.feedbacks[idx].improvements).join(' '),
      idealResponse: state.activeSession.feedbacks[idx].idealResponse
    }))
  };
  
  // Save to history and update localStorage
  state.history.unshift(finalReport);
  localStorage.setItem('interview_coach_history', JSON.stringify(state.history));
  
  // Render report details page
  renderReportView(finalReport);
}

// Render report details view
function renderReportView(report) {
  showView('report-view');
  
  // Update fields
  document.getElementById('report-role-title').textContent = `${report.roleTitle} Interview Report`;
  document.getElementById('report-date').textContent = new Date(report.date).toLocaleDateString();
  document.getElementById('report-score-val').textContent = `${report.score}%`;
  
  // Draw overall score gauge
  const gauge = document.getElementById('report-gauge-circle');
  if (gauge) {
    gauge.style.background = `conic-gradient(var(--accent) 0%, var(--primary) ${report.score}%, var(--bg-sidebar) ${report.score}% 100%)`;
  }
  
  // Populate breakdown score bars
  updateBarWidth('bar-communication', report.categories.communication);
  updateBarWidth('bar-relevance', report.categories.relevance);
  updateBarWidth('bar-technical', report.categories.technical);
  updateBarWidth('bar-confidence', report.categories.confidence);
  
  // Strengths and Improvements lists
  const strengthsList = document.getElementById('report-strengths-list');
  const improvementsList = document.getElementById('report-improvements-list');
  
  if (strengthsList) {
    strengthsList.innerHTML = report.strengths.map(s => `<li>${s}</li>`).join('');
  }
  if (improvementsList) {
    improvementsList.innerHTML = report.improvements.map(i => `<li>${i}</li>`).join('');
  }
  
  // Q&A Breakdown review list
  const qaContainer = document.getElementById('report-qa-container');
  if (qaContainer) {
    qaContainer.innerHTML = report.sessionQA.map((qa, index) => `
      <div class="qa-review-item">
        <div class="qa-question">Q${index + 1}: ${qa.question}</div>
        <div class="qa-user-answer"><strong>Your Answer:</strong> ${qa.answer || '<em>No response recorded</em>'}</div>
        <div class="qa-feedback-box">
          <div class="qa-feedback-title">AI Feedback</div>
          <p>${qa.feedbackText || 'Good response outline.'}</p>
        </div>
        <div class="qa-ideal">
          <div class="qa-ideal-title">Ideal Response Guideline</div>
          <p>${formatParagraphs(qa.idealResponse)}</p>
        </div>
      </div>
    `).join('');
  }
}

function updateBarWidth(id, val) {
  const fill = document.getElementById(id);
  const valLabel = document.getElementById(`${id}-val`);
  if (fill) fill.style.width = `${val}%`;
  if (valLabel) valLabel.textContent = `${val}%`;
}

function formatParagraphs(text) {
  if (!text) return '';
  return text.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('');
}

// App Initialization when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  // Setup router/navigation bindings
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      showView(view);
    });
  });
  
  // Handle forms
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', saveSettings);
  }
  
  const setupForm = document.getElementById('setup-form');
  if (setupForm) {
    setupForm.addEventListener('submit', startInterview);
  }
  
  // Microphone and audio bindings
  const micBtn = document.getElementById('mic-button');
  if (micBtn) micBtn.addEventListener('click', toggleRecording);
  
  const speakerBtn = document.getElementById('speaker-button');
  if (speakerBtn) {
    speakerBtn.addEventListener('click', toggleMute);
    // Initialize speaker icon
    if (!state.voiceEnabled) {
      speakerBtn.classList.add('muted');
    }
  }
  
  // Next question/eval binding
  const nextBtn = document.getElementById('next-question-btn');
  if (nextBtn) nextBtn.addEventListener('click', submitAnswer);
  
  // End session early trigger
  const exitBtn = document.getElementById('exit-session-btn');
  if (exitBtn) exitBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to exit? Your progress for this session will not be saved.")) {
      stopRecording();
      showView('dashboard');
    }
  });
  
  // Load defaults
  showView('dashboard');
});
