import React from "react";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "rocks-score-board-current-match";

const PHASES = {
  PRE: "pre",
  FIRST: "first",
  HALF: "half",
  SECOND: "second",
  FINISHED: "finished",
};

const defaultMatch = {
  phase: PHASES.PRE,
  opponent: "",
  startPlayers: 8,
  matchMinutes: 5,
  first: null,
  second: null,
  timer: {
    remainingSeconds: 300,
    isRunning: false,
  },
  history: [],
};

function clampNumber(value, fallback, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(next)));
}

function createPeriod(startPlayers) {
  return {
    rocks: startPlayers,
    opponent: startPlayers,
  };
}

function createTimer(matchMinutes, isRunning = true) {
  return {
    remainingSeconds: matchMinutes * 60,
    isRunning,
  };
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function loadMatch() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultMatch;
    const parsed = JSON.parse(saved);
    return {
      ...defaultMatch,
      ...parsed,
      timer: {
        ...defaultMatch.timer,
        ...parsed.timer,
        isRunning: false,
      },
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return defaultMatch;
  }
}

function ResultLine({ label, rocks, opponent, large = false }) {
  return (
    <div className={large ? "result-line result-line-large" : "result-line"}>
      <span>{label}</span>
      <strong>
        {rocks} - {opponent}
      </strong>
    </div>
  );
}

function App() {
  const [match, setMatch] = useState(loadMatch);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
  }, [match]);

  useEffect(() => {
    if (!match.timer.isRunning) return undefined;

    const timerId = window.setInterval(() => {
      setMatch((current) => {
        if (!current.timer.isRunning) return current;
        const remainingSeconds = Math.max(0, current.timer.remainingSeconds - 1);
        return {
          ...current,
          timer: {
            remainingSeconds,
            isRunning: remainingSeconds > 0,
          },
        };
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [match.timer.isRunning]);

  const totals = useMemo(() => {
    const first = match.first ?? createPeriod(match.startPlayers);
    const second = match.second ?? createPeriod(match.startPlayers);
    const rocks = first.rocks + second.rocks;
    const opponent = first.opponent + second.opponent;
    const difference = rocks - opponent;
    return { rocks, opponent, difference };
  }, [match.first, match.second, match.startPlayers]);

  const resetMatch = () => {
    setMatch(defaultMatch);
  };

  const updateSetup = (field, value) => {
    setMatch((current) => {
      const next = { ...current, [field]: value };
      const nextMinutes =
        field === "matchMinutes"
          ? clampNumber(value, current.matchMinutes, 1, 30)
          : current.matchMinutes;
      return {
        ...next,
        matchMinutes: nextMinutes,
        timer: createTimer(nextMinutes, false),
      };
    });
  };

  const startFirstHalf = () => {
    const startPlayers = clampNumber(match.startPlayers, 8, 1, 30);
    const matchMinutes = clampNumber(match.matchMinutes, 5, 1, 30);
    setMatch((current) => ({
      ...current,
      phase: PHASES.FIRST,
      startPlayers,
      matchMinutes,
      first: createPeriod(startPlayers),
      second: null,
      timer: createTimer(matchMinutes),
      history: [],
    }));
  };

  const startSecondHalf = () => {
    setMatch((current) => ({
      ...current,
      phase: PHASES.SECOND,
      second: createPeriod(current.startPlayers),
      timer: createTimer(current.matchMinutes),
      history: [],
    }));
  };

  const score = (periodKey, target) => {
    setMatch((current) => {
      const period = current[periodKey];
      if (!period || period[target] <= 0) return current;
      return {
        ...current,
        [periodKey]: {
          ...period,
          [target]: period[target] - 1,
        },
        history: [
          {
            periodKey,
            target,
          },
        ],
      };
    });
  };

  const undoScore = () => {
    setMatch((current) => {
      const last = current.history.at(-1);
      if (!last) return current;
      const period = current[last.periodKey];
      if (!period) return current;
      return {
        ...current,
        [last.periodKey]: {
          ...period,
          [last.target]: Math.min(current.startPlayers, period[last.target] + 1),
        },
        history: [],
      };
    });
  };

  const toggleTimer = () => {
    setMatch((current) => ({
      ...current,
      timer: {
        ...current.timer,
        isRunning:
          current.timer.remainingSeconds > 0 ? !current.timer.isRunning : false,
      },
    }));
  };

  const finishFirstHalf = () => {
    if (!window.confirm("前半を終了しますか？")) return;
    setMatch((current) => ({
      ...current,
      phase: PHASES.HALF,
      timer: {
        ...current.timer,
        isRunning: false,
      },
      history: [],
    }));
  };

  const finishMatch = () => {
    setMatch((current) => ({
      ...current,
      phase: PHASES.FINISHED,
      timer: {
        ...current.timer,
        isRunning: false,
      },
      history: [],
    }));
  };

  const renderAdvantage = (difference = totals.difference, secondRocks = match.second?.rocks ?? 0) => {
    if (difference > 0) {
      const isWinConfirmed = difference > secondRocks;

      if (isWinConfirmed) {
        return (
          <div className="status status-win">
            <strong className="status-main">勝ち確定</strong>
          </div>
        );
      }

      return (
        <div className="status status-win">
          <strong className="status-main">
            勝ち確定まで あと{secondRocks - difference + 1}人
          </strong>
          <span>このままなら勝ち</span>
          <span>あと{difference + 1}人当てられると負け</span>
        </div>
      );
    }

    if (difference === 0) {
      return (
        <div className="status status-draw">
          <strong>あと1人当てれば勝ち</strong>
          <span>あと1人当てられると負け</span>
        </div>
      );
    }

    return (
      <div className="status status-lose">
        <strong>あと{1 - difference}人当てれば勝ち</strong>
        <span>このままなら負け</span>
      </div>
    );
  };

  const currentPeriod =
    match.phase === PHASES.FIRST
      ? match.first
      : match.phase === PHASES.SECOND
        ? match.second
        : null;

  return (
    <main className="app-shell">
      <section className="scoreboard" aria-label="ROCKS 点数ボード">
        <header className="top-bar">
          <div>
            <p className="eyebrow">ROCKS</p>
            <h1>点数ボード</h1>
          </div>
          {match.phase !== PHASES.PRE && (
            <button className="ghost-button" type="button" onClick={resetMatch}>
              新規
            </button>
          )}
        </header>

        {match.phase === PHASES.PRE && (
          <div className="screen setup-screen">
            <label className="field">
              <span>対戦相手</span>
              <input
                value={match.opponent}
                onChange={(event) => updateSetup("opponent", event.target.value)}
                placeholder="相手チーム"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>開始人数</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  inputMode="numeric"
                  value={match.startPlayers}
                  onChange={(event) =>
                    updateSetup(
                      "startPlayers",
                      clampNumber(event.target.value, match.startPlayers, 1, 30),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>試合時間</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  inputMode="numeric"
                  value={match.matchMinutes}
                  onChange={(event) =>
                    updateSetup("matchMinutes", event.target.value)
                  }
                />
              </label>
            </div>

            <button className="primary-button" type="button" onClick={startFirstHalf}>
              前半スタート
            </button>
          </div>
        )}

        {match.phase === PHASES.FIRST && currentPeriod && (
          <GameScreen
            title="前半"
            opponent={match.opponent}
            remainingSeconds={match.timer.remainingSeconds}
            isRunning={match.timer.isRunning}
            period={currentPeriod}
            history={match.history}
            onHit={() => score("first", "opponent")}
            onHitByOpponent={() => score("first", "rocks")}
            onUndo={undoScore}
            onToggleTimer={toggleTimer}
            onFinish={finishFirstHalf}
            finishLabel="前半終了"
          />
        )}

        {match.phase === PHASES.HALF && match.first && (
          <div className="screen">
            <p className="phase-label">ハーフタイム</p>
            <ResultLine
              label="前半結果"
              rocks={match.first.rocks}
              opponent={match.first.opponent}
              large
            />
            <div className="halftime-condition">
              <span className="condition-label">後半開始時点</span>
              {renderAdvantage(
                match.first.rocks + match.startPlayers -
                  (match.first.opponent + match.startPlayers),
                match.startPlayers,
              )}
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={startSecondHalf}
            >
              後半スタート
            </button>
          </div>
        )}

        {match.phase === PHASES.SECOND && currentPeriod && (
          <GameScreen
            title="後半"
            opponent={match.opponent}
            remainingSeconds={match.timer.remainingSeconds}
            isRunning={match.timer.isRunning}
            period={currentPeriod}
            history={match.history}
            onHit={() => score("second", "opponent")}
            onHitByOpponent={() => score("second", "rocks")}
            onUndo={undoScore}
            onToggleTimer={toggleTimer}
            onFinish={finishMatch}
            finishLabel="試合終了"
          >
            <ResultLine
              label="前半スコア"
              rocks={match.first?.rocks ?? 0}
              opponent={match.first?.opponent ?? 0}
            />
            <ResultLine
              label="合計スコア"
              rocks={totals.rocks}
              opponent={totals.opponent}
            />
            {renderAdvantage()}
          </GameScreen>
        )}

        {match.phase === PHASES.FINISHED && match.first && match.second && (
          <div className="screen">
            <p className="phase-label">試合終了</p>
            <ResultLine
              label="前半結果"
              rocks={match.first.rocks}
              opponent={match.first.opponent}
            />
            <ResultLine
              label="後半結果"
              rocks={match.second.rocks}
              opponent={match.second.opponent}
            />
            <ResultLine
              label="合計結果"
              rocks={totals.rocks}
              opponent={totals.opponent}
              large
            />
            <div
              className={`final-result ${
                totals.difference > 0
                  ? "status-win"
                  : totals.difference < 0
                    ? "status-lose"
                    : "status-draw"
              }`}
            >
              {totals.difference > 0
                ? "勝ち"
                : totals.difference < 0
                  ? "負け"
                  : "引き分け"}
            </div>
            <button className="primary-button" type="button" onClick={resetMatch}>
              新しい試合
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function GameScreen({
  title,
  opponent,
  remainingSeconds,
  isRunning,
  period,
  history,
  onHit,
  onHitByOpponent,
  onUndo,
  onToggleTimer,
  onFinish,
  finishLabel,
  children,
}) {
  return (
    <div className="screen game-screen">
      <div className="phase-header">
        <div>
          <p className="phase-label">{title}</p>
          <p className="opponent-label">vs {opponent || "相手チーム"}</p>
        </div>
        <div className="timer">{formatTime(remainingSeconds)}</div>
      </div>

      <div className="player-grid">
        <div className="player-count rocks-count">
          <span>ROCKS残り人数</span>
          <strong>{period.rocks}</strong>
        </div>
        <div className="player-count opponent-count">
          <span>相手残り人数</span>
          <strong>{period.opponent}</strong>
        </div>
      </div>

      {children && <div className="score-stack">{children}</div>}

      <div className="action-grid">
        <button className="hit-button" type="button" onClick={onHit}>
          ROCKSが当てた
        </button>
        <button
          className="hurt-button"
          type="button"
          onClick={onHitByOpponent}
        >
          ROCKSが当てられた
        </button>
      </div>

      <div className="control-grid">
        <button
          className="secondary-button"
          type="button"
          onClick={onUndo}
          disabled={history.length === 0}
        >
          取消
        </button>
        <button className="secondary-button" type="button" onClick={onToggleTimer}>
          {isRunning ? "一時停止" : "再開"}
        </button>
      </div>

      <button className="finish-button" type="button" onClick={onFinish}>
        {finishLabel}
      </button>
    </div>
  );
}

export default App;
