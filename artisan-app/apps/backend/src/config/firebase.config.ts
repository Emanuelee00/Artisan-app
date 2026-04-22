import admin from 'firebase-admin'
import { env, isMock } from './env'
import { FirebaseMock } from '../mocks/firebase.mock'

let fcmInstance: admin.messaging.Messaging | FirebaseMock

if (isMock('FIREBASE_PROJECT_ID')) {
  fcmInstance = new FirebaseMock()
} else {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   env.FIREBASE_PROJECT_ID,
        privateKey:  env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
      }),
    })
  }
  fcmInstance = admin.messaging()
}

export const fcm = fcmInstance as admin.messaging.Messaging
