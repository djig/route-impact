import styles from '../../../styles/button.module.css';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.button}>{children}</div>;
}
