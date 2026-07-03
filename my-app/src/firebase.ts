// Firebase SDK re-exports for centralized import management
// All Firebase services should be imported from this module
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export { firestore, storage, auth, functions };
