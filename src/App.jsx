import { useEffect, useRef, useState } from "react";
import "./App.css";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

const YEAR = 2026;
const MONTH = 6;

const defaultHabits = [
  { id: 1, name: "筋トレ" },
  { id: 2, name: "勉強" },
  { id: 3, name: "睡眠" },
];

const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];

const daysInMonth = new Date(YEAR, MONTH, 0).getDate();

const firstDayOfMonth = new Date(YEAR, MONTH - 1, 1).getDay();

const getInitialDay = () => {
  const now = new Date();
  const isTargetMonth =
    now.getFullYear() === YEAR && now.getMonth() + 1 === MONTH;

  return isTargetMonth ? now.getDate() : 1;
};

const makeDateKey = (day) => {
  const mm = String(MONTH).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${YEAR}-${mm}-${dd}`;
};

const getWeekday = (day) => {
  const date = new Date(YEAR, MONTH - 1, day);
  return weekLabels[date.getDay()];
};

function SortableHabit({
  habit,
  value,
  onProgressChange,
  onRequestDelete,
}) {
  const pointerRef = useRef({
    down: false,
    activeProgress: false,
    startX: 0,
    startY: 0,
    moved: false,
    lockedVertical: false,
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: habit.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const resetPointer = () => {
    pointerRef.current = {
      down: false,
      activeProgress: false,
      startX: 0,
      startY: 0,
      moved: false,
      lockedVertical: false,
    };
  };

  const updateByPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percent = (x / rect.width) * 100;

    onProgressChange(habit.id, percent);
  };

  const handlePointerDown = (event) => {
    pointerRef.current = {
      down: true,
      activeProgress: false,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      lockedVertical: false,
    };

    if (listeners.onPointerDown) {
      listeners.onPointerDown(event);
    }
  };

  const handlePointerMove = (event) => {
    if (isDragging) {
      resetPointer();
      return;
    }

    const pointer = pointerRef.current;
    if (!pointer.down) return;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      pointer.moved = true;
    }

    const isVertical = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6;
    const isHorizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6;

    // 縦方向に動かしている時は達成度を触らない
    if (isVertical && !pointer.activeProgress) {
      pointer.lockedVertical = true;
      return;
    }

    // 横に動かした時だけ達成度変更モード
    if (isHorizontal && !pointer.lockedVertical) {
      pointer.activeProgress = true;
    }

    if (pointer.activeProgress) {
      updateByPointer(event);
    }
  };

  const handlePointerUp = (event) => {
    if (isDragging) {
      resetPointer();
      return;
    }

    const pointer = pointerRef.current;

    // 縦移動っぽい操作の後は、タップ扱いで達成度を変えない
    if (pointer.lockedVertical) {
      resetPointer();
      return;
    }

    // タップだけでも少し記録できる
    if (pointer.down && !pointer.moved) {
      updateByPointer(event);
    }

    resetPointer();
  };
  const handlePointerLeave = (event) => {
    const pointer = pointerRef.current;

    if (!pointer.activeProgress) return;

    const rect = event.currentTarget.getBoundingClientRect();

    // 右側に抜けたら100%、左側に抜けたら0%で確定
    if (event.clientX >= rect.right) {
      onProgressChange(habit.id, 100);
    } else if (event.clientX <= rect.left) {
      onProgressChange(habit.id, 0);
    }

    resetPointer();
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`taskRow ${isDragging ? "dragging" : ""}`}
    >
      <div
        className="taskBar"
        {...attributes}
        {...listeners}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <div className="taskFill" style={{ width: `${value}%` }} />

        <div className="taskContent">
          <div className="taskText">
            <h3>{habit.name}</h3>
          </div>
        </div>
      </div>

      <button
        className="deleteButton"
        onClick={() => onRequestDelete(habit)}
        aria-label={`${habit.name}を削除`}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onPointerCancel={(event) => event.stopPropagation()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="deleteIcon">
          <path d="M7 7L17 17" />
          <path d="M17 7L7 17" />
        </svg>
      </button>
    </div>
  );
}

export default function App() {
  const dateButtonRefs = useRef({});
  const taskListRef = useRef(null);

  const [selectedDay, setSelectedDay] = useState(getInitialDay());

  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem("habits-dnd-v3");
    return saved ? JSON.parse(saved) : defaultHabits;
  });

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem("habitLogs-dnd-v3");
    return saved ? JSON.parse(saved) : {};
  });

  const [input, setInput] = useState("");
  const [showMonth, setShowMonth] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 260,
        tolerance: 10,
      },
    })
  );

  // タスクバーが実際に並んでいる範囲だけにドラッグを制限する
  const restrictToTaskListOnly = ({ transform, activeNodeRect }) => {
    const listElement = taskListRef.current;

    if (!listElement || !activeNodeRect) {
      return {
        ...transform,
        x: 0,
      };
    }

    const listRect = listElement.getBoundingClientRect();

    const minY = listRect.top - activeNodeRect.top;
    const maxY = listRect.bottom - activeNodeRect.bottom;

    const limitedY = Math.min(Math.max(transform.y, minY), maxY);

    return {
      ...transform,
      x: 0,
      y: limitedY,
    };
  };

  useEffect(() => {
    localStorage.setItem("habits-dnd-v3", JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem("habitLogs-dnd-v3", JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    const button = dateButtonRefs.current[selectedDay];

    if (button) {
      button.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [selectedDay]);

  const getLogKey = (habitId, day = selectedDay) => {
    return `${habitId}_${makeDateKey(day)}`;
  };

  const getDayValues = (day) => {
    return habits.map((habit) => Number(logs[getLogKey(habit.id, day)] || 0));
  };

  const hasDayRecord = (day) => {
    return getDayValues(day).some((value) => value > 0);
  };

  const getDayAverage = (day) => {
    if (habits.length === 0) return 0;

    const values = getDayValues(day);
    const total = values.reduce((sum, value) => sum + value, 0);

    return Math.round(total / habits.length);
  };

  const updateProgress = (habitId, percent) => {
    const logKey = getLogKey(habitId);
    const progress = Math.max(0, Math.min(100, percent));

    setLogs((prev) => {
      const updated = { ...prev };

      if (progress <= 0) {
        delete updated[logKey];
      } else {
        updated[logKey] = progress;
      }

      return updated;
    });
  };

  const addHabit = () => {
    if (!input.trim()) return;

    setHabits((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: input.trim(),
      },
    ]);

    setInput("");
  };

  const deleteHabit = (habitId) => {
    setHabits((prev) => prev.filter((habit) => habit.id !== habitId));

    setLogs((prev) => {
      const updated = { ...prev };

      Object.keys(updated).forEach((key) => {
        if (key.startsWith(`${habitId}_`)) {
          delete updated[key];
        }
      });

      return updated;
    });
  };

  const requestDeleteHabit = (habit) => {
    setDeleteTarget(habit);
  };

  const cancelDeleteHabit = () => {
    setDeleteTarget(null);
  };

  const confirmDeleteHabit = () => {
    if (!deleteTarget) return;

    deleteHabit(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setHabits((items) => {
      const oldIndex = items.findIndex((habit) => habit.id === active.id);
      const newIndex = items.findIndex((habit) => habit.id === over.id);

      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const todayValues = getDayValues(selectedDay);
  const totalProgress = todayValues.reduce((sum, value) => sum + value, 0);
  const achievementRate =
    habits.length === 0 ? 0 : Math.round(totalProgress / habits.length);

  const recordedDays = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(
    (day) => hasDayRecord(day)
  ).length;

  return (
    <main className="app">
      <section className="card">
        <header className="top">
          <div>
            <h1>Habit</h1>
            <p>2026年6月</p>
          </div>

          <div className="rate">
            <strong>{achievementRate}%</strong>
            <span>達成度</span>
          </div>
        </header>

        <div className="dateScroller">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const isSelected = day === selectedDay;
            const weekday = getWeekday(day);
            const hasRecord = hasDayRecord(day);

            return (
              <button
                key={day}
                ref={(el) => {
                  dateButtonRefs.current[day] = el;
                }}
                className={`dateButton ${isSelected ? "selected" : ""} ${
                  hasRecord ? "hasRecord" : ""
                }`}
                onClick={() => setSelectedDay(day)}
              >
                <span>{weekday}</span>
                <strong>{day}</strong>
              </button>
            );
          })}
        </div>

        <section className="selectedDate">
          <div>
            <h2>
              6月{selectedDay}日 {getWeekday(selectedDay)}曜日
            </h2>
          </div>

          <button
            className="monthToggle"
            onClick={() => setShowMonth((prev) => !prev)}
          >
            {showMonth ? "閉じる" : "月全体"}
          </button>
        </section>

        {showMonth && (
          <section className="monthPanel">
            <div className="monthPanelTop">
              <h3>2026年6月</h3>
              <span>{recordedDays}日の記録</span>
            </div>

            <div className="monthWeek">
              {weekLabels.map((label) => (
                <div
                  key={label}
                  className={`monthWeekLabel ${
                    label === "日" ? "sunday" : ""
                  } ${label === "土" ? "saturday" : ""}`}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="monthGrid">
              {Array.from({ length: firstDayOfMonth }, (_, i) => (
                <div key={`blank-${i}`} className="monthBlank" />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const hasRecord = hasDayRecord(day);
                const isSelected = day === selectedDay;
                const average = getDayAverage(day);
                const weekday = getWeekday(day);

                return (
                  <button
                    key={day}
                    className={`monthDay ${hasRecord ? "hasRecord" : ""} ${
                      isSelected ? "selected" : ""
                    } ${weekday === "日" ? "sunday" : ""} ${
                      weekday === "土" ? "saturday" : ""
                    }`}
                    onClick={() => {
                      setSelectedDay(day);
                    }}
                  >
                    <span>{day}</span>
                    {hasRecord && (
                      <div style={{ height: `${Math.max(18, average)}%` }} />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="todayTasks">
          <div className="taskList" ref={taskListRef}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToTaskListOnly]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={habits.map((habit) => habit.id)}
                strategy={verticalListSortingStrategy}
              >
                {habits.map((habit) => {
                  const value = Number(logs[getLogKey(habit.id)] || 0);

                  return (
                    <SortableHabit
                      key={habit.id}
                      habit={habit}
                      value={value}
                      onProgressChange={updateProgress}
                      onRequestDelete={requestDeleteHabit}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        </section>

        <div className="addArea">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="習慣を追加"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addHabit();
              }
            }}
          />
          <button onClick={addHabit}>＋</button>
        </div>

        <p className="hint">
          横に動かすと達成度。長押しして上下に動かすと並び替え。
        </p>

        {deleteTarget && (
          <div className="confirmOverlay">
            <div className="confirmModal">
              <div className="confirmIcon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 7L17 17" />
                  <path d="M17 7L7 17" />
                </svg>
              </div>

              <h3>この習慣を削除しますか？</h3>

              <p>「{deleteTarget.name}」の記録も一緒に削除されます。</p>

              <div className="confirmActions">
                <button className="cancelButton" onClick={cancelDeleteHabit}>
                  キャンセル
                </button>

                <button
                  className="confirmDeleteButton"
                  onClick={confirmDeleteHabit}
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}