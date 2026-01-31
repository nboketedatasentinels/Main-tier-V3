/* eslint-disable @typescript-eslint/no-explicit-any */
import * as firestore from 'firebase/firestore';
import { auth } from './firebase';

const logError = (op: string, ref: firestore.DocumentReference | firestore.Query | null, error: any) => {
  if (error?.code === 'permission-denied' || error?.message?.includes('denied') || error?.code === '403') {
    const path = (ref as any)?.path || ((ref as any)?.query ? 'query' : 'unknown');
    console.error(`🔥 [Firestore Denied] ${op} at ${path}`, {
      uid: auth.currentUser?.uid,
      code: error.code,
      message: error.message,
      path: path
    });
  }
};

export * from 'firebase/firestore';

export const getDoc: typeof firestore.getDoc = async (ref: firestore.DocumentReference<any, any>) => {
  try {
    return await firestore.getDoc(ref);
  } catch (error) {
    logError('getDoc', ref, error);
    throw error;
  }
};

export const getDocs: typeof firestore.getDocs = async (ref: firestore.Query<any, any>) => {
  try {
    return await firestore.getDocs(ref);
  } catch (error) {
    logError('getDocs', ref, error);
    throw error;
  }
};

export const runTransaction: typeof firestore.runTransaction = async (db, updateFunction, options) => {
  return firestore.runTransaction(db, async (transaction) => {
    const wrappedTransaction = new Proxy(transaction, {
      get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver);
        if (prop === 'get' && typeof val === 'function') {
          return async (ref: firestore.DocumentReference<any, any>) => {
            try {
              return await val.call(target, ref);
            } catch (error) {
              logError('transaction.get', ref, error);
              throw error;
            }
          };
        }
        return val;
      }
    });
    return updateFunction(wrappedTransaction as firestore.Transaction);
  }, options);
};

export const onSnapshot: typeof firestore.onSnapshot = (...args: any[]) => {
  const ref = args[0] as firestore.DocumentReference<any, any> | firestore.Query<any, any>;
  const lastArg = args[args.length - 1];
  const secondToLastArg = args[args.length - 2];

  // Attempt to intercept error callbacks in various onSnapshot signatures
  if (typeof lastArg === 'function' && typeof secondToLastArg === 'function') {
    // Signature: (ref, onNext, onError) or (ref, options, onNext, onError)
    const originalError = lastArg;
    args[args.length - 1] = (err: any) => {
      logError('onSnapshot', ref, err);
      originalError(err);
    };
  } else if (typeof lastArg === 'object' && lastArg !== null && 'error' in lastArg) {
    // Signature: (ref, observer) or (ref, options, observer)
    const originalError = (lastArg as any).error;
    (lastArg as any).error = (err: any) => {
      logError('onSnapshot', ref, err);
      if (typeof originalError === 'function') originalError(err);
    };
  }

  return (firestore.onSnapshot as any)(...args);
};
