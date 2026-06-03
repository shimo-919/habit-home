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

const daysInMonth = new Date(YEAR, MONTH, 0).getDate();

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
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
};

// 並び替え中に横へズレないようにする
const restrictToVerticalOnly = ({ transform }) => {
  return {
    ...transform,
    x: 0,
  };
};

function SortableHabit({ habit, value, onProgressChange, onDelete }) {
  const pointerRef = useRef({
    down: false,
    activeProgress: false,
    startX: 0,
    startY: 0,
    moved: false,
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
    };

    if (listeners.onPointerDown) {
      listeners.onPointerDown(event);
    }
  };

  const handlePointerMove = (event) => {
    const pointer = pointerRef.current;
    if (!pointer.down) return;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      pointer.moved = true;
    }

    // 横に動かした時だけ達成度変更モード
    if (!pointer.activeProgress) {
      const isHorizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6;

      if (isHorizontal) {
        pointer.activeProgress = true;
      }
    }

    if (pointer.activeProgress) {
      updateByPointer(event);
    }
  };

  const handlePointerUp = (event) => {
    const pointer = pointerRef.current;

    // タップだけでも少し記録できる
    if (pointer.down && !pointer.moved) {
      updateByPointer(event);
    }

    pointerRef.current = {
      down: false,
      activeProgress: false,
      startX: 0,
      startY: 0,
      moved: false,
    };
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`taskBar ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="taskFill" style={{ width: `${value}%` }} />

      <div className="taskContent">
        <div className="taskText">
          <h3>{habit.name}</h3>
        </div>

        <div
          className="taskActions"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onPointerCancel={(event) => event.stopPropagation()}
        >
          <button onClick={() => onDelete(habit.id)}>×</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const dateButtonRefs = useRef({});

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 260,
        tolerance: 10,
      },
    })
  );

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
              <h3>6月</h3>
              <span>{recordedDays}日の記録</span>
            </div>

            <div className="monthGrid">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const hasRecord = hasDayRecord(day);
                const isSelected = day === selectedDay;
                const average = getDayAverage(day);

                return (
                  <button
                    key={day}
                    className={`monthDay ${hasRecord ? "hasRecord" : ""} ${
                      isSelected ? "selected" : ""
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalOnly]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={habits.map((habit) => habit.id)}
            strategy={verticalListSortingStrategy}
          >
            <section className="todayTasks">
              {habits.map((habit) => {
                const value = Number(logs[getLogKey(habit.id)] || 0);

                return (
                  <SortableHabit
                    key={habit.id}
                    habit={habit}
                    value={value}
                    onProgressChange={updateProgress}
                    onDelete={deleteHabit}
                  />
                );
              })}
            </section>
          </SortableContext>
        </DndContext>

        <div className="addArea">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="習慣を追加"
          />
          <button onClick={addHabit}>＋</button>
        </div>

        <p className="hint">
          横に動かすと達成度。長押しして上下に動かすと並び替え。
        </p>
      </section>
    </main>
  );
}