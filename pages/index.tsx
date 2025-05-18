import { NextPage } from 'next';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Pickovo API Server</title>
        <meta name="description" content="Pickovo Backend API Server" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <span className={styles.highlight}>Pickovo</span> API Server
        </h1>

        <p className={styles.description}>
          This is the backend server for the Pickovo car repair service application.
        </p>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h2>API Status</h2>
            <p>✅ Server is running correctly</p>
          </div>

          <div className={styles.card}>
            <h2>Available Endpoints</h2>
            <ul className={styles.list}>
              <li><code>/api/auth/user</code> - User authentication</li>
              <li><code>/api/bookings</code> - Bookings management</li>
              <li><code>/api/mechanics</code> - Mechanics listing</li>
              <li><code>/api/vehicles</code> - Vehicle management</li>
              <li><code>/api/wallet</code> - Wallet operations</li>
              <li><code>/api/messages</code> - Booking messages</li>
              <li><code>/api/notifications</code> - User notifications</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>Powered by Next.js and Supabase</p>
      </footer>
    </div>
  );
};

export default Home;
