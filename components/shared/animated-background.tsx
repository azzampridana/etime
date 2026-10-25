import styles from "./animated-background.module.css";

export function AnimatedBackground() {
  return (
    <div aria-hidden="true" className={styles.background}>
      <div className={styles.layer} />
      <div className={styles.layer} />
      <div className={styles.layer} />
    </div>
  );
}
