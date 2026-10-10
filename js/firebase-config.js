// ===================================================================
// ALIPSTORE — Firebase config (ADMIN app)
// Ganti seluruh nilai di bawah dengan kredensial project Firebase kamu.
// Ambil dari: Firebase Console → Project Settings → General → Your apps → SDK setup
// Nilai-nilai ini AMAN untuk ditaruh di frontend (bukan secret key server),
// keamanan sebenarnya diatur lewat Firestore/Storage Security Rules.
// ===================================================================
export const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY",
  authDomain: "GANTI_DENGAN_PROJECT.firebaseapp.com",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT.appspot.com",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID"
};

// Info kontak toko dipakai oleh web user (admin app hanya referensi)
export const STORE_INFO = {
  name: "ALIPSTORE",
  tagline: "Marketplace Digital Premium",
  whatsapp: "6285840840520", // format internasional tanpa '+'
  telegram: "Alipgg61"
};
