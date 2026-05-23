export type Exercise = {
  id: string
  name: string
  category: string
  sets: string
  reps: string
  rest: string
  notes: string
}

export type Workout = {
  id: string
  title: string
  week: number
  day: string
  focus: string
  status: 'completed' | 'today' | 'upcoming'
  exercises: Exercise[]
}

export type Assessment = {
  goal: string
  movementNotes: string
  strengthNotes: string
  cardioNotes: string
  trainerFocus: string
}

export type Client = {
  id: string
  name: string
  programName: string
  currentWeek: number
  totalWeeks: number
  workoutsCompleted: number
  totalWorkouts: number
  assessment: Assessment
  workouts: Workout[]
}

export type WorkoutLog = {
  id: string
  clientId: string
  workoutId: string
  workoutTitle: string
  date: string
  difficulty: number
  painReported: boolean
  notes: string
}