// ===================================================================
// ALIPSTORE — Firebase config (ADMIN app)
// Ganti seluruh nilai di bawah dengan kredensial project Firebase kamu.
// Ambil dari: Firebase Console → Project Settings → General → Your apps → SDK setup
// Nilai-nilai ini AMAN untuk ditaruh di frontend (bukan secret key server),
// keamanan sebenarnya diatur lewat Firestore/Storage Security Rules.
// ===================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyA-aJN6URep5JLr6kD_B7BOcS4my0eE8rU",
  authDomain: "alipwebsite.firebaseapp.com",
  projectId: "alipwebsite",
  storageBucket: "alipwebsite.firebasestorage.app",
  messagingSenderId: "986121502670",
  appId: "1:986121502670:web:76dd389a6f366086eeb59f"
};
};
};

// Info kontak toko dipakai oleh web user (admin app hanya referensi)
export const STORE_INFO = {
  name: "ALIPSTORE",
  tagline: "Marketplace Digital Premium",
  whatsapp: "6285840840520", // format internasional tanpa '+'
  telegram: "Alipgg61"
};
