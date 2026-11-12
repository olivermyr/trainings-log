import { useWorkoutCount } from '../db/queries';

/** History and Progress are built in later work packages; until then they show honest empty states. */
export function History() {
  const count = useWorkoutCount();
  return (
    <div className="screen-enter">
      <h1 className="large-title">History</h1>
      {count === 0 && (
        <div className="empty">
          <h3>No workouts yet</h3>
          Completed workouts will appear here.
        </div>
      )}
    </div>
  );
}

export function Progress() {
  const count = useWorkoutCount();
  return (
    <div className="screen-enter">
      <h1 className="large-title">Progress</h1>
      {count === 0 && (
        <div className="empty">
          <h3>Nothing to analyse yet</h3>
          Charts and records are calculated from your logged workouts.
        </div>
      )}
    </div>
  );
}
