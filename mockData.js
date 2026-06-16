// mockData.js - Preset interview questions and offline simulated feedback evaluator

const PRESET_ROLES = {
  frontend: {
    title: "Frontend Developer",
    questions: [
      "Can you explain the difference between absolute, relative, fixed, and sticky positioning in CSS?",
      "What is event delegation in JavaScript, and why is it useful?",
      "How does React's Virtual DOM work, and how does it optimize rendering performance?",
      "Explain the concept of 'state management' and when you would choose Redux/Context API over local state.",
      "How do you optimize a web page for performance and reduce its initial load time?"
    ]
  },
  backend: {
    title: "Backend Developer",
    questions: [
      "Explain the differences between REST and GraphQL. When would you prefer one over the other?",
      "What is database indexing, and how does it improve query performance? Are there any downsides?",
      "How do you design a system to be horizontally scalable vs. vertically scalable?",
      "Can you explain SQL Injection and how you would prevent it in your application backend?",
      "Describe how JWT (JSON Web Tokens) work for session management and authentication."
    ]
  },
  datascientist: {
    title: "Data Scientist",
    questions: [
      "What is the difference between supervised and unsupervised learning? Give an example of each.",
      "Explain the bias-variance tradeoff and how it impacts machine learning model performance.",
      "How does a Random Forest model work under the hood? What are its key advantages?",
      "What is overfitting, and what techniques do you use to prevent it in your models?",
      "Can you explain the difference between precision and recall? In what scenario would you prioritize precision?"
    ]
  },
  pm: {
    title: "Product Manager",
    questions: [
      "How do you prioritize features for a product roadmap when dealing with competing stakeholder demands?",
      "Tell me about a time a product launch failed or didn't meet expectations. What did you learn?",
      "How would you measure the success of a new feature like 'reactions' on a messaging platform?",
      "How do you gather and synthesize user feedback to inform product development?",
      "Describe your approach to handling conflict between engineering teams and business stakeholders."
    ]
  },
  ux: {
    title: "UI/UX Designer",
    questions: [
      "What is your process for designing a new user flow from scratch? Walk me through the stages.",
      "How do you conduct user research, and how do those insights influence your design decisions?",
      "Explain the concept of 'accessibility (a11y)' and how you ensure your designs are inclusive.",
      "How do you handle negative feedback from a client or developer about one of your designs?",
      "What are the key differences when designing for mobile viewport constraints versus desktop displays?"
    ]
  }
};

// Simple rule-based evaluation engine for the simulated offline mode
function getSimulatedFeedback(question, answer, roleTitle) {
  const answerLength = answer ? answer.trim().split(/\s+/).length : 0;
  
  let score = 50; // base score
  let communicationScore = 50;
  let relevanceScore = 50;
  let technicalScore = 50;
  
  const keywords = {
    positioning: ['document flow', 'viewport', 'parent', 'offset', 'layout'],
    delegation: ['bubble', 'bubbling', 'listener', 'parent', 'event target', 'propagation'],
    dom: ['diff', 'reconciliation', 'memory', 'render', 'update', 'batch'],
    state: ['global', 'prop drilling', 'redux', 'context', 'flux', 'store'],
    performance: ['minify', 'lazy load', 'cdn', 'compression', 'bundle', 'cache'],
    rest: ['endpoint', 'graphql', 'http method', 'query', 'payload', 'over-fetching'],
    indexing: ['b-tree', 'lookup', 'binary search', 'write penalty', 'overhead'],
    scalability: ['load balancer', 'stateless', 'replica', 'sharding', 'hardware'],
    injection: ['sanitize', 'parameterized', 'orm', 'sql', 'escaping', 'query'],
    jwt: ['signature', 'payload', 'header', 'stateless', 'token', 'localstorage'],
    supervised: ['labels', 'classification', 'regression', 'clustering', 'unlabeled'],
    bias: ['underfitting', 'overfitting', 'tradeoff', 'complexity', 'variance'],
    forest: ['decision tree', 'bagging', 'ensemble', 'subsets', 'bootstrap'],
    overfitting: ['regularization', 'dropout', 'cross-validation', 'early stopping'],
    precision: ['false positive', 'false negative', 'f1-score', 'threshold', 'recall'],
    roadmap: ['rice', 'moscow', 'impact', 'effort', 'stakeholder', 'strategy'],
    failed: ['retrospective', 'kpi', 'metrics', 'pivot', 'learnings'],
    reactions: ['engagement', 'active users', 'retention', 'funnel', 'ctr'],
    research: ['persona', 'interview', 'survey', 'usability', 'quantitative', 'qualitative'],
    conflict: ['alignment', 'compromise', 'data-driven', 'priority', 'shared goal'],
    flow: ['wireframe', 'user journey', 'persona', 'prototype', 'sketch'],
    a11y: ['contrast', 'screen reader', 'aria', 'wcag', 'semantic html'],
    feedback: ['iterate', 'critique', 'user testing', 'collaboration', 'empathy']
  };

  // 1. Analyze length
  if (answerLength < 10) {
    score = Math.max(10, score - 20);
    communicationScore -= 25;
    relevanceScore -= 15;
    technicalScore -= 20;
  } else if (answerLength > 15 && answerLength < 50) {
    score += 15;
    communicationScore += 10;
  } else if (answerLength >= 50 && answerLength < 150) {
    score += 25;
    communicationScore += 25;
    technicalScore += 10;
  } else {
    score += 15; // too verbose might dilute score slightly
    communicationScore += 15;
  }

  // 2. Keyword check
  let matchedKeywords = [];
  const questionLower = question.toLowerCase();
  
  // Find which question keyword dictionary to check
  for (const [key, list] of Object.entries(keywords)) {
    if (questionLower.includes(key)) {
      list.forEach(kw => {
        if (answer.toLowerCase().includes(kw)) {
          matchedKeywords.push(kw);
        }
      });
      break;
    }
  }

  if (matchedKeywords.length > 0) {
    const keywordBoost = matchedKeywords.length * 8;
    score += keywordBoost;
    technicalScore += keywordBoost * 1.2;
    relevanceScore += keywordBoost * 0.8;
  } else if (answerLength > 15) {
    // some relevant length but no specific keywords
    relevanceScore -= 10;
    technicalScore -= 15;
  }

  // Cap scores between 0 and 100
  score = Math.min(100, Math.max(0, Math.round(score)));
  communicationScore = Math.min(100, Math.max(0, Math.round(communicationScore)));
  relevanceScore = Math.min(100, Math.max(0, Math.round(relevanceScore)));
  technicalScore = Math.min(100, Math.max(0, Math.round(technicalScore)));
  const confidenceScore = answerLength > 30 ? 85 : (answerLength > 10 ? 70 : 40);

  // Formulate detailed responses
  const feedback = {
    overallScore: score,
    categories: {
      communication: communicationScore,
      relevance: relevanceScore,
      technical: technicalScore,
      confidence: confidenceScore
    },
    strengths: [
      answerLength > 30 ? "Good detail level and explanation length." : "Clear response structure.",
      matchedKeywords.length > 0 ? `Effectively mentioned core terminology like: ${matchedKeywords.join(', ')}.` : "Direct response to the prompt."
    ],
    improvements: [
      answerLength < 30 ? "Try to expand your answers with real-world examples (using the STAR method)." : "Avoid filler words and structure explanations systematically.",
      matchedKeywords.length === 0 ? "Incorporate more industry-specific technical vocabulary and concepts." : "Briefly mention how this applies practically in production or design scenarios."
    ],
    idealResponse: `Here is a structured template for a high-scoring response:\n\n1. **Direct Definition/Concept**: Start by defining the core concept clearly and directly.\n2. **Mechanism/How it works**: Explain the underlying mechanism or logic (e.g. why the concept is used).\n3. **Practical Example**: Draw on a mock scenario: 'In my experience, when building X, we faced Y, and by using this concept, we achieved Z...'\n4. **Trade-offs / Key Details**: Mention edge cases, performance considerations, or alternative options to demonstrate senior-level depth.`
  };

  return feedback;
}

// Export if running in node, otherwise attach to window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRESET_ROLES, getSimulatedFeedback };
} else {
  window.PRESET_ROLES = PRESET_ROLES;
  window.getSimulatedFeedback = getSimulatedFeedback;
}
