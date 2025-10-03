const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDnSdq0hxP0xmrZT-QuBM8Gfh2jeKj0QT0",
  authDomain: "sportsmagician-audio.firebaseapp.com",
  projectId: "sportsmagician-audio",
  storageBucket: "sportsmagician-audio.firebasestorage.app",
  messagingSenderId: "527934608433",
  appId: "1:527934608433:web:95d450cb32e2f1513fb110",
  measurementId: "G-CMEYMHRY34"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// User data
const users = [
  // Admin
  {
    email: 'admin@SportsMagician.com',
    password: '11111111',
    role: 'admin',
    displayName: 'Admin'
  },
  
  // Publishers (pub1 to pub10)
  ...Array.from({ length: 10 }, (_, i) => ({
    email: `pub${i + 1}@SportsMagician.com`,
    password: '11111111',
    role: 'publisher',
    displayName: `Publisher ${i + 1}`
  })),
  
  // Subscribers
  {
    email: 'skyler@SportsMagician.com',
    password: '11111111',
    role: 'subscriber',
    displayName: 'Skyler'
  },
  {
    email: 'joe@SportsMagician.com',
    password: '11111111',
    role: 'subscriber',
    displayName: 'Joe'
  },
  {
    email: 'stephen@SportsMagician.com',
    password: '11111111',
    role: 'subscriber',
    displayName: 'Stephen'
  },
  {
    email: 'jake@SportsMagician.com',
    password: '11111111',
    role: 'subscriber',
    displayName: 'Jake'
  },
  {
    email: 'bill@SportsMagician.com',
    password: '11111111',
    role: 'subscriber',
    displayName: 'Bill'
  },
  {
    email: 'chase@SportsMagician.com',
    password: '11111111',
    role: 'subscriber',
    displayName: 'Chase'
  },
  {
    email: 'andrew@SportsMagician.com',
    password: '11111111',
    role: 'subscriber',
    displayName: 'Andrew'
  }
];

async function createUser(userData) {
  try {
    console.log(`Creating user: ${userData.email} (${userData.role})`);
    
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      userData.email, 
      userData.password
    );
    
    // Create user profile in Firestore
    const userProfile = {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      role: userData.role,
      displayName: userData.displayName,
      createdAt: new Date(),
      isActive: true
    };
    
    await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
    
    console.log(`✅ Successfully created: ${userData.email}`);
    return { success: true, email: userData.email };
    
  } catch (error) {
    console.error(`❌ Failed to create ${userData.email}:`, error.message);
    return { success: false, email: userData.email, error: error.message };
  }
}

async function createAllUsers() {
  console.log('🚀 Starting user creation process...\n');
  
  const results = [];
  
  for (const userData of users) {
    const result = await createUser(userData);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Summary:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('\nFailed users:');
    failed.forEach(f => console.log(`  - ${f.email}: ${f.error}`));
  }
  
  console.log('\n🎉 User creation process completed!');
  console.log('\nLogin credentials:');
  console.log('Email: [user-email]');
  console.log('Password: 11111111');
  
  process.exit(0);
}

// Run the script
createAllUsers().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
