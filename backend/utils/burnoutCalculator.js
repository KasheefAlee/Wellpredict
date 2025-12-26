/**
 * Burnout Score Calculator
 * 
 * IMPORTANT: Not all 0-4 answers have the same "direction".
 * Some questions are protective (higher = better) and must be inverted to
 * become "risk" components.
 *
 * Risk components (0-4 each):
 * - Workload manageability: (4 - workload)  // higher manageability => lower risk
 * - Stress level: stress                    // higher stress => higher risk
 * - Sleep quality: (4 - sleep)              // higher sleep quality => lower risk
 * - Engagement: (4 - engagement)            // higher engagement => lower risk
 * - Recovery: (4 - recovery)                // higher recovery => lower risk
 * 
 * Parameters:
 * - Workload manageability (0-4)
 * - Stress level (0-4)
 * - Sleep quality (0-4)
 * - Engagement (0-4)
 * - Recovery (0-4)
 * 
 * Total possible: 20
 * Score = (sum / 20) * 100
 * 
 * Risk Levels:
 * - 0-30: Low
 * - 31-60: Moderate
 * - 61-80: High
 * - 81-100: Critical
 */

function calculateBurnoutScore(workload, stress, sleep, engagement, recovery) {
  // Validate inputs
  const params = [workload, stress, sleep, engagement, recovery];
  for (const param of params) {
    if (typeof param !== 'number' || param < 0 || param > 4) {
      throw new Error('All parameters must be numbers between 0 and 4');
    }
  }
  
  // Convert answers to risk components (max 20)
  const workloadRisk = 4 - workload;
  const stressRisk = stress;
  const sleepRisk = 4 - sleep;
  const engagementRisk = 4 - engagement;
  const recoveryRisk = 4 - recovery;

  const sum = workloadRisk + stressRisk + sleepRisk + engagementRisk + recoveryRisk;
  
  // Normalize to 0-100
  const score = (sum / 20) * 100;
  
  // Round to 2 decimal places
  const roundedScore = Math.round(score * 100) / 100;
  
  // Determine risk level
  let riskLevel;
  if (roundedScore <= 30) {
    riskLevel = 'low';
  } else if (roundedScore <= 60) {
    riskLevel = 'moderate';
  } else if (roundedScore <= 80) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }
  
  return {
    score: roundedScore,
    riskLevel,
    sum,
    breakdown: {
      workload,
      stress,
      sleep,
      engagement,
      recovery,
      risk_components: {
        workload: workloadRisk,
        stress: stressRisk,
        sleep: sleepRisk,
        engagement: engagementRisk,
        recovery: recoveryRisk,
      }
    }
  };
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {
  calculateBurnoutScore,
  getWeekNumber
};

