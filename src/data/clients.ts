export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  videoLink: string;
};

export type PlanWeek = {
  weekNumber: number;
  status: "unlocked" | "locked" | "completed";
  workouts: {
    title: string;
    exercises: Exercise[];
  }[];
};

export type Client = {
  id: string;
  name: string;
  planName: string;
  currentWeek: number;
  assessment: {
    startingWeight: string;
    bodyFat: string;
    muscleMass: string;
    waist: string;
    hips: string;
    chest: string;
    notes: string;
  };
  goals: {
    mainGoal: string;
    shortTerm: string;
    longTerm: string;
  };
  pastWorkouts: string[];
  progressData: {
    label: string;
    weight: number;
  }[];
  planWeeks: PlanWeek[];
};

export const clients: Client[] = [
  {
    id: "adam",
    name: "Adam",
    planName: "10-Week Push Pull Legs",
    currentWeek: 1,
    assessment: {
      startingWeight: "185 lbs",
      bodyFat: "18%",
      muscleMass: "145 lbs",
      waist: "34 in",
      hips: "40 in",
      chest: "42 in",
      notes: "Strong baseline. Focus on consistency and progressive overload.",
    },
    goals: {
      mainGoal: "Build strength and improve body composition",
      shortTerm: "Complete 3 workouts per week",
      longTerm: "Finish the 10-week program",
    },
    pastWorkouts: [
      "Intro assessment session",
      "Push workout before app launch",
      "Leg day before app launch",
    ],
    progressData: [
      { label: "Start", weight: 185 },
      { label: "Week 1", weight: 184 },
      { label: "Week 2", weight: 183 },
    ],
    planWeeks: [
      {
        weekNumber: 1,
        status: "unlocked",
        workouts: [
          {
            title: "Push Day",
            exercises: [
              {
                name: "Bench Press",
                sets: "3",
                reps: "10",
                weight: "Trainer assigned",
                rest: "90 sec",
                videoLink: "https://www.youtube.com/",
              },
              {
                name: "Shoulder Press",
                sets: "3",
                reps: "12",
                weight: "Trainer assigned",
                rest: "90 sec",
                videoLink: "https://www.youtube.com/",
              },
            ],
          },
        ],
      },
      {
        weekNumber: 2,
        status: "locked",
        workouts: [],
      },
    ],
  },
  {
    id: "suzanne",
    name: "Suzanne",
    planName: "10-Week Golf Strength and Mobility",
    currentWeek: 1,
    assessment: {
      startingWeight: "—",
      bodyFat: "—",
      muscleMass: "—",
      waist: "—",
      hips: "—",
      chest: "—",
      notes: "Focus on hip-friendly strength, rotation control, and golf mobility.",
    },
    goals: {
      mainGoal: "Improve golf strength and mobility",
      shortTerm: "Move with less discomfort",
      longTerm: "Build confidence through a full golf swing",
    },
    pastWorkouts: [
      "Golf mobility assessment",
      "Hip-friendly strength session",
      "Shoulder-friendly upper body session",
    ],
    progressData: [
      { label: "Start", weight: 0 },
      { label: "Week 1", weight: 0 },
    ],
    planWeeks: [
      {
        weekNumber: 1,
        status: "unlocked",
        workouts: [
          {
            title: "Golf Mobility Day",
            exercises: [
              {
                name: "Seated Rotation Drill",
                sets: "2",
                reps: "10 each side",
                weight: "Bodyweight",
                rest: "45 sec",
                videoLink: "https://www.youtube.com/",
              },
              {
                name: "Band Row",
                sets: "3",
                reps: "12",
                weight: "Band resistance",
                rest: "60 sec",
                videoLink: "https://www.youtube.com/",
              },
            ],
          },
        ],
      },
      {
        weekNumber: 2,
        status: "locked",
        workouts: [],
      },
    ],
  },
  {
    id: "robert",
    name: "Robert",
    planName: "Seated Strength and Stability Plan",
    currentWeek: 1,
    assessment: {
      startingWeight: "—",
      bodyFat: "—",
      muscleMass: "—",
      waist: "—",
      hips: "—",
      chest: "—",
      notes: "Prioritize seated movements, controlled effort, and safe progression.",
    },
    goals: {
      mainGoal: "Maintain strength safely",
      shortTerm: "Complete seated strength sessions consistently",
      longTerm: "Improve daily movement confidence",
    },
    pastWorkouts: ["Seated machine circuit", "Light upper body session"],
    progressData: [{ label: "Start", weight: 0 }],
    planWeeks: [
      {
        weekNumber: 1,
        status: "unlocked",
        workouts: [
          {
            title: "Seated Strength Day",
            exercises: [
              {
                name: "Seated Leg Press",
                sets: "2",
                reps: "12",
                weight: "Trainer assigned",
                rest: "90 sec",
                videoLink: "https://www.youtube.com/",
              },
              {
                name: "Seated Row",
                sets: "2",
                reps: "12",
                weight: "Trainer assigned",
                rest: "90 sec",
                videoLink: "https://www.youtube.com/",
              },
            ],
          },
        ],
      },
      {
        weekNumber: 2,
        status: "locked",
        workouts: [],
      },
    ],
  },
  {
    id: "carol",
    name: "Carol",
    planName: "Summer Strength Plan",
    currentWeek: 1,
    assessment: {
      startingWeight: "—",
      bodyFat: "—",
      muscleMass: "—",
      waist: "—",
      hips: "—",
      chest: "—",
      notes: "New client profile. Add full assessment results later.",
    },
    goals: {
      mainGoal: "Stay active and follow a structured plan",
      shortTerm: "Complete weekly workouts",
      longTerm: "Build long-term training consistency",
    },
    pastWorkouts: ["Small group class attendance"],
    progressData: [{ label: "Start", weight: 0 }],
    planWeeks: [
      {
        weekNumber: 1,
        status: "unlocked",
        workouts: [
          {
            title: "Full Body Day",
            exercises: [
              {
                name: "Goblet Squat",
                sets: "3",
                reps: "10",
                weight: "Trainer assigned",
                rest: "90 sec",
                videoLink: "https://www.youtube.com/",
              },
              {
                name: "Lat Pulldown",
                sets: "3",
                reps: "12",
                weight: "Trainer assigned",
                rest: "90 sec",
                videoLink: "https://www.youtube.com/",
              },
            ],
          },
        ],
      },
      {
        weekNumber: 2,
        status: "locked",
        workouts: [],
      },
    ],
  },
];