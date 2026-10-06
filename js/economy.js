// economy.js - score/currency and upgrade pricing ("strategy game" layer).

class Economy {
  constructor(startingScore = 0) {
    this.score = startingScore;
  }

  canAfford(cost) {
    return this.score >= cost;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    this.score -= cost;
    return true;
  }

  earn(amount) {
    this.score += amount;
  }

  static hireWorkerCost(currentWorkerCount) {
    const base = 40;
    const growth = 1.35;
    return Math.round(base * Math.pow(growth, currentWorkerCount - 1));
  }

  static speedUpgradeCost(currentUpgradeLevel) {
    const base = 60;
    const growth = 1.5;
    return Math.round(base * Math.pow(growth, currentUpgradeLevel));
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Economy };
}
