export class Scoring {
  constructor() {
    // Player scores
    this.playerScores = {
      unitsLost: 0,
      unitsLostByType: {
        circle: 0,
        square: 0,
        triangle: 0
      },
      shotsFired: 0,
      buildingsConstructed: 0,
      woodCollected: 0,
      goldCollected: 0,
      tilesCaptured: 0,
      unitsProduced: 0,
      unitsProducedByType: {
        circle: 0,
        square: 0,
        triangle: 0
      }
    };

    // Enemy scores
    this.enemyScores = {
      unitsLost: 0,
      unitsLostByType: {
        circle: 0,
        square: 0,
        triangle: 0
      },
      shotsFired: 0,
      buildingsConstructed: 0,
      woodCollected: 0,
      goldCollected: 0,
      tilesCaptured: 0,
      unitsProduced: 0,
      unitsProducedByType: {
        circle: 0,
        square: 0,
        triangle: 0
      }
    };

    this.gameMode = null;
  }

  setGameMode(gameMode) {
    this.gameMode = gameMode;
  }

  unitLost(unitType, isEnemy) {
    if (isEnemy) {
      this.enemyScores.unitsLost++;
      this.enemyScores.unitsLostByType[unitType]++;
    } else {
      this.playerScores.unitsLost++;
      this.playerScores.unitsLostByType[unitType]++;
    }
  }

  shotFired(isEnemy) {
    if (isEnemy) {
      this.enemyScores.shotsFired++;
    } else {
      this.playerScores.shotsFired++;
    }
  }

  buildingConstructed(isEnemy) {
    if (isEnemy) {
      this.enemyScores.buildingsConstructed++;
    } else {
      this.playerScores.buildingsConstructed++;
    }
  }

  woodCollectedAmount(amount, isEnemy) {
    if (isEnemy) {
      this.enemyScores.woodCollected += amount;
    } else {
      this.playerScores.woodCollected += amount;
    }
  }

  goldCollectedAmount(amount, isEnemy) {
    if (isEnemy) {
      this.enemyScores.goldCollected += amount;
    } else {
      this.playerScores.goldCollected += amount;
    }
  }

  tileCaptured(isEnemy) {
    if (isEnemy) {
      this.enemyScores.tilesCaptured++;
    } else {
      this.playerScores.tilesCaptured++;
    }
  }

  unitProduced(unitType, isEnemy) {
    console.log(`Scoring unit produced - Type: ${unitType}, IsEnemy: ${isEnemy}`);
    
    if (isEnemy) {
      this.enemyScores.unitsProduced++;
      this.enemyScores.unitsProducedByType[unitType]++;
    } else {
      this.playerScores.unitsProduced++;
      this.playerScores.unitsProducedByType[unitType]++;
    }
  }

  reset() {
    this.playerScores = {
      unitsLost: 0,
      unitsLostByType: {
        circle: 0,
        square: 0,
        triangle: 0
      },
      shotsFired: 0,
      buildingsConstructed: 0,
      woodCollected: 0,
      goldCollected: 0,
      tilesCaptured: 0,
      unitsProduced: 0,
      unitsProducedByType: {
        circle: 0,
        square: 0,
        triangle: 0
      }
    };

    this.enemyScores = {
      unitsLost: 0,
      unitsLostByType: {
        circle: 0,
        square: 0,
        triangle: 0
      },
      shotsFired: 0,
      buildingsConstructed: 0,
      woodCollected: 0,
      goldCollected: 0,
      tilesCaptured: 0,
      unitsProduced: 0,
      unitsProducedByType: {
        circle: 0,
        square: 0,
        triangle: 0
      }
    };

    this.gameMode = null;
  }

  getScores() {
    return {
      player: this.playerScores,
      enemy: this.enemyScores,
      gameMode: this.gameMode
    };
  }
}