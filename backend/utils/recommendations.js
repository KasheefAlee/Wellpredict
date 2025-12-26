function generateRecommendations(burnoutScore) {
  const score = typeof burnoutScore === 'number' ? burnoutScore : parseFloat(burnoutScore || 0);

  if (score >= 81) {
    return [
      'Encourage regular breaks',
      'Delegate tasks to reduce workload',
      'Provide mental health support resources'
    ];
  } else if (score >= 61) {
    return [
      'Offer flexible working hours',
      'Focus on workload management',
      'Monitor work/life balance'
    ];
  } else if (score >= 31) {
    return [
      'Consider a team-building event',
      'Encourage open communication'
    ];
  }
  return ['Ensure the team maintains good morale'];
}

function getRiskLevelLabel(score) {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Moderate';
  if (score <= 80) return 'High';
  return 'Critical';
}

module.exports = { generateRecommendations, getRiskLevelLabel };


