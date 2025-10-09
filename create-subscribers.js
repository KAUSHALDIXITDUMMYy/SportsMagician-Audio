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

// Subscriber emails
const subscriberEmails = [
  'AlexGame@Sportsmagician.com',
  'ArielCalls@Sportsmagician.com',
  'AnthonyCalls@Sportsmagician.com',
  'BrodyMichaelSr82Sunny@Sportsmagician.com',
  'ChrisAustraliaGameCalls@Sportsmagician.com',
  'DanteCalls@Sportsmagician.com',
  'DinelleGameCalls@Sportsmagician.com',
  'JeffAuroraGameCalls@Sportsmagician.com',
  'JohnKimCalls@Sportsmagician.com',
  'JoshGameCalls@Sportsmagician.com',
  'LeoGameCalls@Sportsmagician.com',
  'MikeGameCallsSignal@Sportsmagician.com',
  'PenneyCallsGroups@Sportsmagician.com',
  'SaintCajetan@Sportsmagician.com',
  'ZapperCalls@Sportsmagician.com',
  'MattMLBCalls@Sportsmagician.com',
  'PKRCalls@Sportsmagician.com',
  'GGroupCalls@Sportsmagician.com',
  'GavinCalls@Sportsmagician.com',
  'JontayPorterCalls@Sportsmagician.com',
  'RichieVillaGameCalls@Sportsmagician.com',
  'LandonGameCalls@Sportsmagician.com',
  'CallsChatAllan@Sportsmagician.com',
  'DanaKrisCalls@Sportsmagician.com',
  'ShaheedCalls@Sportsmagician.com',
  'ZachGameCalls@Sportsmagician.com',
  'LandonCalls@Sportsmagician.com',
  'MikemaxCalls@Sportsmagician.com',
  'XarloGameCalls@Sportsmagician.com',
  'JoshLeonCalls@Sportsmagician.com',
  'TonyCallsGroup@Sportsmagician.com',
  'BoneGameCalls@Sportsmagician.com',
  'WhiteMagicCalls@Sportsmagician.com',
  'MattGameCalls@Sportsmagician.com',
  'OliverJulianCalls@Sportsmagician.com',
  'EVGameCalls@Sportsmagician.com',
  'SandsSoloCalls@Sportsmagician.com',
  'FranCalls@Sportsmagician.com',
  'DanILGameCalls@Sportsmagician.com',
  'JoeyCalls@Sportsmagician.com',
  'GrayBertCalls@Sportsmagician.com',
  'FrankRiccardiCalls@Sportsmagician.com',
  'BruceGameCalls@Sportsmagician.com',
  'RGBCalls@Sportsmagician.com',
  'JohnCalls@Sportsmagician.com',
  'TsDailyCalls@Sportsmagician.com',
  'JoeCalls@Sportsmagician.com',
  'TurtleGameCalls@Sportsmagician.com',
  'BedsyDailyCalls@Sportsmagician.com',
  'DonaldGameCalls@Sportsmagician.com',
  'SmikeGameCalls@Sportsmagician.com',
  'CognitoDailyCalls@Sportsmagician.com',
  'QrohnCalls@Sportsmagician.com',
  'DedricDailyCalls@Sportsmagician.com',
  'SleazeCalls@Sportsmagician.com',
  'OogiAlyjah@Sportsmagician.com',
  'OogiConnerCalls@Sportsmagician.com',
  'OogiJustinCalls@Sportsmagician.com',
  'OogiMarCalls@Sportsmagician.com',
  'OogiNateCalls@Sportsmagician.com',
  'OogiPeterCalls@Sportsmagician.com',
  'OogiRichCalls@Sportsmagician.com',
  'OogiHyperBalboaCalls@Sportsmagician.com',
  'OogiSamG@Sportsmagician.com',
  'OogiSamIsaacsonCalls@Sportsmagician.com',
  'OogiKyleCalls@Sportsmagician.com',
  'OogiJoshCalls@Sportsmagician.com',
  'OogiJackSCalls@Sportsmagician.com',
  'OogiBivvBCalls@Sportsmagician.com',
  'OogiMichaelCalls@Sportsmagician.com',
  'OogiMateoCalls@Sportsmagician.com',
  'OogiTCalls@Sportsmagician.com',
  'OogiCharlieCalls@Sportsmagician.com',
  'OogiLoganCalls@Sportsmagician.com',
  'OogiJacobCalls@Sportsmagician.com',
  'OogiTmacCalls@Sportsmagician.com',
  'OogiDanCalls@Sportsmagician.com',
  'OogiBondarCalls@Sportsmagician.com',
  'OogiTomasCalls@Sportsmagician.com',
  'OogiRyanCalls@Sportsmagician.com',
  'OogiJoshLeonCalls@Sportsmagician.com',
  'OogiJayShapiroCalls@Sportsmagician.com',
  'OogiJakeCalls@Sportsmagician.com',
  'OogiCarsonCalls@Sportsmagician.com',
  'OogiAdamCall@Sportsmagician.com',
  'OogiADCalls@Sportsmagician.com',
  'OogiAlecCalls@Sportsmagician.com',
  'OogiBobbyCalls@Sportsmagician.com',
  'OogiBenCalls@Sportsmagician.com',
  'OogiJFCalls@Sportsmagician.com',
  'OogiCACalls@Sportsmagician.com',
  'OogiDavidCalls@Sportsmagician.com',
  'OogiChonemCalls@Sportsmagician.com',
  'OogiBenWhiteCalls@Sportsmagician.com',
  'OogiDragonCalls@Sportsmagician.com',
  'OogiCCalls@Sportsmagician.com',
  'OogiRagnarCalls@Sportsmagician.com',
  'OogiBillyCalls@Sportsmagician.com',
  'OogiTeleCalls@Sportsmagician.com',
  'OogiBrandonCalls@Sportsmagician.com',
  'OogiLarfCalls@Sportsmagician.com',
  'MLBCallsAlex@Sportsmagician.com',
  'OogiFish@Sportsmagician.com',
  'AndrewCalls@Sportsmagician.com',
  'CharlieCalls@Sportsmagician.com',
  'DanGameCalls@Sportsmagician.com',
  'EbobCalls@Sportsmagician.com',
  'FrankieCalls@Sportsmagician.com',
  'JackCalls@Sportsmagician.com',
  'JayCalls@Sportsmagician.com',
  'JGCalls@Sportsmagician.com',
  'JohnMCalls@Sportsmagician.com',
  'KevGroupCalls@Sportsmagician.com',
  'MateoCalls@Sportsmagician.com',
  'RayCalls@Sportsmagician.com',
  'RichieCalls@Sportsmagician.com',
  'StevenGameCalls@Sportsmagician.com',
  'TylerCalls@Sportsmagician.com',
  'VictorCalls@Sportsmagician.com',
  'XavierGameCalls@Sportsmagician.com',
  'PatrickCalls@Sportsmagician.com',
  'TwophillsCalls@Sportsmagician.com',
  'AdamGroupCalls@Sportsmagician.com',
  'RealBroadcastBoothCalls@Sportsmagician.com',
  'ChadCalls@Sportsmagician.com',
  'JerryCalls@Sportsmagician.com',
  'MikeGameCalls@Sportsmagician.com',
  'PravCanadaGameCalls@Sportsmagician.com',
  'SandsSteinCalls@Sportsmagician.com',
  'AllDailyGameCalls@Sportsmagician.com',
  'KevinGameCalls@Sportsmagician.com',
  'EvGameCalls@Sportsmagician.com'
];

// Create user objects
const users = subscriberEmails.map(email => {
  const displayName = email.split('@')[0];
  return {
    email: email,
    password: '11111111',
    role: 'subscriber',
    displayName: displayName
  };
});

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
  console.log('🚀 Starting subscriber creation process...');
  console.log(`📝 Total subscribers to create: ${users.length}\n`);
  
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
  
  console.log('\n🎉 Subscriber creation process completed!');
  console.log('\nLogin credentials for all subscribers:');
  console.log('Email: [subscriber-email]');
  console.log('Password: 11111111');
  
  process.exit(0);
}

// Run the script
createAllUsers().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});



