import { initializeApp }  from 'firebase/app'
import { getFirestore }   from 'firebase/firestore'
import { getAuth }        from 'firebase/auth'

const firebaseConfig = {
  apiKey:            'AIzaSyBYhlVF8ALu3pTX7Lbq2nh3Ve3qUnKWhUc',
  authDomain:        'flowport-abidjan.firebaseapp.com',
  projectId:         'flowport-abidjan',
  storageBucket:     'flowport-abidjan.appspot.com',
  messagingSenderId: '',
  appId:             '',
}

const app  = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)
