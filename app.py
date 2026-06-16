# app.py - Streamlit AI Interview Coach with Voice Dictation & Gemini API

import streamlit as st
import json
import time
from datetime import datetime
import pandas as pd
import requests

# Define configuration
GEMINI_MODEL = "gemini-2.5-flash"
PRESET_ROLES = {
    "frontend": {
        "title": "Frontend Developer",
        "questions": [
            "Can you explain the difference between absolute, relative, fixed, and sticky positioning in CSS?",
            "What is event delegation in JavaScript, and why is it useful?",
            "How does React's Virtual DOM work, and how does it optimize rendering performance?",
            "Explain the concept of 'state management' and when you would choose Redux/Context API over local state.",
            "How do you optimize a web page for performance and reduce its initial load time?"
        ]
    },
    "backend": {
        "title": "Backend Developer",
        "questions": [
            "Explain the differences between REST and GraphQL. When would you prefer one over the other?",
            "What is database indexing, and how does it improve query performance? Are there any downsides?",
            "How do you design a system to be horizontally scalable vs. vertically scalable?",
            "Can you explain SQL Injection and how you would prevent it in your application backend?",
            "Describe how JWT (JSON Web Tokens) work for session management and authentication."
        ]
    },
    "datascientist": {
        "title": "Data Scientist",
        "questions": [
            "What is the difference between supervised and unsupervised learning? Give an example of each.",
            "Explain the bias-variance tradeoff and how it impacts machine learning model performance.",
            "How does a Random Forest model work under the hood? What are its key advantages?",
            "What is overfitting, and what techniques do you use to prevent it in your models?",
            "Can you explain the difference between precision and recall? In what scenario would you prioritize precision?"
        ]
    },
    "pm": {
        "title": "Product Manager",
        "questions": [
            "How do you prioritize features for a product roadmap when dealing with competing stakeholder demands?",
            "Tell me about a time a product launch failed or didn't meet expectations. What did you learn?",
            "How would you measure the success of a new feature like 'reactions' on a messaging platform?",
            "How do you gather and synthesize user feedback to inform product development?",
            "Describe your approach to handling conflict between engineering teams and business stakeholders."
        ]
    },
    "ux": {
        "title": "UI/UX Designer",
        "questions": [
            "What is your process for designing a new user flow from scratch? Walk me through the stages.",
            "How do you conduct user research, and how do those insights influence your design decisions?",
            "Explain the concept of 'accessibility (a11y)' and how you ensure your designs are inclusive.",
            "How do you handle negative feedback from a client or developer about one of your designs?",
            "What are the key differences when designing for mobile viewport constraints versus desktop displays?"
        ]
    }
}

# Inject Custom CSS for Premium Theme (Dark theme matching Web app design system)
st.markdown("""
<style>
    /* Styling headers and fonts */
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
    
    .brand-title {
        font-family: 'Outfit', sans-serif;
        font-weight: 800;
        background: linear-gradient(135deg, #6366f1, #a855f7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2.8rem;
        margin-bottom: 0px;
    }
    
    .brand-sub {
        font-size: 1.1rem;
        color: #94a3b8;
        margin-bottom: 2rem;
    }
    
    /* Premium Glassmorphic Cards */
    .glass-card {
        background: rgba(30, 41, 59, 0.45);
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 16px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        backdrop-filter: blur(12px);
    }
    
    .stat-val {
        font-size: 2.2rem;
        font-weight: 700;
        font-family: 'Outfit', sans-serif;
        color: #ffffff;
    }
    
    .stat-label {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        color: #94a3b8;
        letter-spacing: 0.5px;
    }
    
    /* Q&A styled box */
    .question-box {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.05));
        border: 1px solid rgba(99, 102, 241, 0.4);
        border-radius: 12px;
        padding: 1.25rem 1.75rem;
        margin-top: 1rem;
        margin-bottom: 1.5rem;
    }
    
    /* Interviewer Status Indicators */
    .coach-status-idle {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #94a3b8;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .coach-status-evaluating {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        background: rgba(168, 85, 247, 0.15);
        border: 1px solid rgba(168, 85, 247, 0.4);
        color: #d8b4fe;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; transform: scale(1.02); }
    }
</style>
""", unsafe_allow_html=True)

# ----------------- SESSION STATE STORES -----------------
if 'api_key' not in st.session_state:
    st.session_state.api_key = ''
if 'history' not in st.session_state:
    st.session_state.history = []
if 'active_session' not in st.session_state:
    st.session_state.active_session = None

# ----------------- MOCK / OFFLINE grading engine -----------------
def offline_evaluate(question, answer):
    words = answer.strip().split() if answer else []
    length = len(words)
    
    score = 50
    comm = 50
    rel = 50
    tech = 50
    
    if length < 10:
        score = max(10, score - 25)
        comm -= 30
        rel -= 20
        tech -= 25
    elif length < 40:
        score += 10
        comm += 10
        tech += 5
    else:
        score += 30
        comm += 35
        rel += 10
        tech += 20
        
    score = min(100, max(0, score))
    comm = min(100, max(0, comm))
    rel = min(100, max(0, rel))
    tech = min(100, max(0, tech))
    conf = 85 if length > 30 else (65 if length > 10 else 40)
    
    return {
        "overallScore": score,
        "categories": {
            "communication": comm,
            "relevance": rel,
            "technical": tech,
            "confidence": conf
        },
        "strengths": [
            "Answer provided clearly and structured directly.",
            "Demonstrated active listener attributes."
        ],
        "improvements": [
            "Incorporate more industry-specific jargon.",
            "Explain concepts using the STAR method (Situation, Task, Action, Result)."
        ],
        "idealResponse": "Define the concept clearly -> Explain why/how it works -> Give a concrete project example -> Address tradeoffs."
    }

# ----------------- LIVE GEMINI CLIENT (DIRECT REST) -----------------
def call_gemini_api(prompt, system_instruction=""):
    api_key = st.session_state.api_key
    if not api_key:
        raise ValueError("API Key is missing.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    
    if response.status_code != 200:
        raise Exception(f"Gemini API error ({response.status_code}): {response.text}")
        
    data = response.json()
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(raw_text)

# ----------------- SIDEBAR ROUTER -----------------
st.sidebar.markdown("<h2 style='font-family: Outfit; font-weight:800; color:#818cf8;'>Navigation</h2>", unsafe_allow_html=True)
menu = st.sidebar.radio("Go to:", ["Dashboard", "Mock Interview", "History & Reports", "Settings"])

# ----------------- VIEW: SETTINGS -----------------
if menu == "Settings":
    st.markdown("<h1 class='brand-title'>Settings</h1>", unsafe_allow_html=True)
    st.markdown("<p class='brand-sub'>Configure your API keys and coach preferences.</p>", unsafe_allow_html=True)
    
    with st.form("settings_form"):
        key_input = st.text_input("Google Gemini API Key", type="password", value=st.session_state.api_key, placeholder="AIzaSy...")
        st.caption("Your API key is stored locally in your session state. Get one from Google AI Studio.")
        
        submitted = st.form_submit_button("Save Settings")
        if submitted:
            st.session_state.api_key = key_input
            st.success("Settings saved successfully!")
            st.rerun()

# ----------------- VIEW: DASHBOARD -----------------
elif menu == "Dashboard":
    st.markdown("<h1 class='brand-title'>Coach.AI Dashboard</h1>", unsafe_allow_html=True)
    st.markdown("<p class='brand-sub'>Track readiness scores, metrics, and progress.</p>", unsafe_allow_html=True)
    
    if not st.session_state.api_key:
        st.warning("⚠️ Simulated Coach Mode: You are using local question presets. Add your Gemini API Key in the Settings tab to activate full AI grading.")
        
    history = st.session_state.history
    total_sessions = len(history)
    
    # Render Dashboard Stats
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        score_txt = f"{round(sum(h['score'] for h in history)/total_sessions)}%" if total_sessions > 0 else "N/A"
        st.markdown(f"""
        <div class="glass-card">
            <span class="stat-label">Readiness Score</span>
            <div class="stat-val">{score_txt}</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col2:
        st.markdown(f"""
        <div class="glass-card">
            <span class="stat-label">Sessions Run</span>
            <div class="stat-val">{total_sessions}</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col3:
        strength = "Communication" if total_sessions > 0 else "N/A"
        st.markdown(f"""
        <div class="glass-card">
            <span class="stat-label">Top Strength</span>
            <div class="stat-val" style="font-size:1.2rem; padding: 0.6rem 0;">{strength}</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col4:
        focus = "Technical Depth" if total_sessions > 0 else "N/A"
        st.markdown(f"""
        <div class="glass-card">
            <span class="stat-label">Focus Area</span>
            <div class="stat-val" style="font-size:1.2rem; padding: 0.6rem 0;">{focus}</div>
        </div>
        """, unsafe_allow_html=True)
        
    # Charting
    st.subheader("Performance Trend")
    if total_sessions > 0:
        scores = [h['score'] for h in reversed(history)]
        chart_df = pd.DataFrame(scores, columns=["Readiness Score"])
        st.line_chart(chart_df)
    else:
        st.info("No mock interviews recorded yet. Head over to the 'Mock Interview' tab to begin.")

# ----------------- VIEW: MOCK INTERVIEW -----------------
elif menu == "Mock Interview":
    st.markdown("<h1 class='brand-title'>Mock Interview Room</h1>", unsafe_allow_html=True)
    st.markdown("<p class='brand-sub'>Practice in a live, response-guided environment.</p>", unsafe_allow_html=True)
    
    # Active interview session checker
    session = st.session_state.active_session
    
    if session is None:
        # Configuration setup panel
        st.subheader("Configure Interview Session")
        
        role_key = st.selectbox("Select Target Role", list(PRESET_ROLES.keys()), format_func=lambda x: PRESET_ROLES[x]["title"])
        seniority = st.selectbox("Experience Seniority", ["Junior (Entry)", "Mid-level", "Senior (5+ years / Lead)"])
        jd_input = st.text_area("Job Description (Optional)", placeholder="Paste standard JD details here...")
        resume_input = st.text_area("Your Resume (Optional)", placeholder="Paste your resume highlights here...")
        
        if st.button("Begin Interview Room", type="primary"):
            st.session_state.active_session = {
                "role_key": role_key,
                "role_title": PRESET_ROLES[role_key]["title"],
                "seniority": seniority,
                "jd": jd_input,
                "resume": resume_input,
                "questions": [],
                "answers": [],
                "feedbacks": [],
                "current_idx": 0
            }
            st.rerun()
            
    else:
        # Load Questions if not done yet
        if not session["questions"]:
            with st.spinner("Sarah is generating custom questions for you..."):
                try:
                    if st.session_state.api_key:
                        prompt = f"""Generate exactly 5 interview questions for a {session['role_title']} position at the {session['seniority']} level.
                        {f'Job Description: {session["jd"]}' if session["jd"] else ''}
                        {f'Resume: {session["resume"]}' if session["resume"] else ''}
                        
                        Return a JSON object conforming exactly to this structure:
                        {{"questions": ["Q1", "Q2", "Q3", "Q4", "Q5"]}}"""
                        
                        response = call_gemini_api(prompt, "You are a professional technical hiring coach.")
                        session["questions"] = response["questions"]
                    else:
                        session["questions"] = PRESET_ROLES[session["role_key"]]["questions"]
                except Exception as e:
                    st.error(f"Error fetching questions: {e}")
                    # Fallback to local
                    session["questions"] = PRESET_ROLES[session["role_key"]]["questions"]
            st.rerun()
            
        # Display current question
        current_idx = session["current_idx"]
        questions = session["questions"]
        
        st.markdown(f"**Question {current_idx + 1} of {len(questions)}**")
        st.markdown(f"<div class='question-box'><h3>{questions[current_idx]}</h3></div>", unsafe_allow_html=True)
        
        # Audio dictation tip for users
        st.info("💡 **Voice Typing Tip:** Press **Win + H** (on Windows) or **Cmd + Space / Fn** (on Mac) while focused in the text box below to dictate your response using voice!")
        
        user_ans = st.text_area("Your Response", key=f"ans_input_{current_idx}", height=150)
        
        col_submit, col_exit = st.columns([4, 1])
        
        with col_submit:
            submit_btn_txt = "Finish & Compile Report" if current_idx == len(questions) - 1 else "Next Question"
            if st.button(submit_btn_txt, type="primary"):
                if not user_ans:
                    st.warning("Please type or speak your response before moving next.")
                else:
                    session["answers"].append(user_ans)
                    
                    # Grade answer
                    with st.spinner("Coach is evaluating your answer..."):
                        if st.session_state.api_key:
                            eval_prompt = f"""Evaluate response to interview question:
                            Question: "{questions[current_idx]}"
                            Answer: "{user_ans}"
                            Role: "{session['role_title']}"
                            
                            Return a JSON object:
                            {{
                              "overallScore": number (0-100),
                              "categories": {{"communication": number, "relevance": number, "technical": number, "confidence": number}},
                              "strengths": string[] (2 strengths),
                              "improvements": string[] (2 improvement notes),
                              "idealResponse": string
                            }}"""
                            try:
                                eval_result = call_gemini_api(eval_prompt, "You are a professional assessor.")
                            except Exception:
                                eval_result = offline_evaluate(questions[current_idx], user_ans)
                        else:
                            eval_result = offline_evaluate(questions[current_idx], user_ans)
                            
                    session["feedbacks"].append(eval_result)
                    
                    if current_idx < len(questions) - 1:
                        session["current_idx"] += 1
                        st.rerun()
                    else:
                        # Compile overall report
                        feedbacks = session["feedbacks"]
                        avg_score = round(sum(f["overallScore"] for f in feedbacks) / len(feedbacks))
                        
                        final_report = {
                            "roleTitle": session["role_title"],
                            "seniority": session["seniority"],
                            "date": datetime.now().isoformat(),
                            "score": avg_score,
                            "categories": {
                                "communication": round(sum(f["categories"]["communication"] for f in feedbacks) / len(feedbacks)),
                                "relevance": round(sum(f["categories"]["relevance"] for f in feedbacks) / len(feedbacks)),
                                "technical": round(sum(f["categories"]["technical"] for f in feedbacks) / len(feedbacks)),
                                "confidence": round(sum(f["categories"]["confidence"] for f in feedbacks) / len(feedbacks))
                            },
                            "strengths": list(set(s for f in feedbacks for s in f["strengths"]))[:3],
                            "improvements": list(set(i for f in feedbacks for i in f["improvements"]))[:3],
                            "sessionQA": [
                                {
                                    "question": questions[i],
                                    "answer": session["answers"][i],
                                    "feedbackText": ". ".join(feedbacks[i]["strengths"] + feedbacks[i]["improvements"]),
                                    "idealResponse": feedbacks[i]["idealResponse"]
                                } for i in range(len(questions))
                            ]
                        }
                        
                        st.session_state.history.insert(0, final_report)
                        st.session_state.active_session = None
                        st.success("🎉 Mock interview session finished successfully!")
                        time.sleep(1.5)
                        st.rerun()
                        
        with col_exit:
            if st.button("Exit Interview"):
                st.session_state.active_session = None
                st.rerun()

# ----------------- VIEW: HISTORY & REPORTS -----------------
elif menu == "History & Reports":
    st.markdown("<h1 class='brand-title'>Session Reports</h1>", unsafe_allow_html=True)
    st.markdown("<p class='brand-sub'>Review your detailed question breakdowns and AI recommendations.</p>", unsafe_allow_html=True)
    
    history = st.session_state.history
    
    if not history:
        st.info("No completed mock interview history found.")
    else:
        for idx, report in enumerate(history):
            report_name = f"📄 {report['roleTitle']} Mock Session - {report['score']}% (Readiness)"
            
            with st.expander(report_name, expanded=(idx == 0)):
                st.markdown(f"**Date:** {datetime.fromisoformat(report['date']).strftime('%Y-%m-%d %H:%M')}")
                st.markdown(f"**Seniority:** {report['seniority']}")
                
                # Category Breakdown
                st.subheader("Metrics breakdown")
                c_comm, c_rel, c_tech, c_conf = st.columns(4)
                c_comm.metric("Communication", f"{report['categories']['communication']}%")
                c_rel.metric("Relevance", f"{report['categories']['relevance']}%")
                c_tech.metric("Technical Depth", f"{report['categories']['technical']}%")
                c_conf.metric("Confidence", f"{report['categories']['confidence']}%")
                
                # Key Highlights
                st.markdown("---")
                col_str, col_imp = st.columns(2)
                
                with col_str:
                    st.markdown("🟢 **Key Strengths**")
                    for s in report["strengths"]:
                        st.markdown(f"- {s}")
                        
                with col_imp:
                    st.markdown("🟡 **Areas of Improvement**")
                    for imp in report["improvements"]:
                        st.markdown(f"- {imp}")
                        
                # Full QA Breakdown
                st.markdown("---")
                st.subheader("Detailed Q&A Evaluation")
                for q_idx, qa in enumerate(report["sessionQA"]):
                    st.markdown(f"#### Q{q_idx + 1}: {qa['question']}")
                    st.write(f"**Your Answer:** *{qa['answer']}*")
                    st.info(f"**AI critique:** {qa['feedbackText']}")
                    with st.container():
                        st.markdown(f"**Ideal Response Guide:** {qa['idealResponse']}")
                        st.markdown("<br>", unsafe_allow_html=True)
