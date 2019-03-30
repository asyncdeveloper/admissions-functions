const functions  = require('firebase-functions');
const admin      = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

exports.updateUser = functions.firestore.document('users/{userId}').onUpdate((change, context) => {

        // ...or the previous value before this update
        const previousValue = change.before.data();

        // Get an object representing the document e.g. {'name': 'Marie', 'age': 66}
        const newValue = change.after.data();

        return null;
});
