const functions  = require('firebase-functions');
const admin      = require('firebase-admin');
const _ = require("underscore");

admin.initializeApp(functions.config().firebase);

exports.updateUser = functions.firestore.document('users/{userId}').onUpdate((change, context) => {

    const userId = context.params.userId;

    // ...or the previous value before this update
    const from = change.before.data();

    // Get an object representing the document e.g. {'name': 'Marie', 'age': 66}
    const to = change.after.data();

    let objDiff = _.omit(from, (v,k) => {
        return to[k] === v;
    });

    delete objDiff.interestedCourses;

    //Was there changes in update
    if(Object.keys(objDiff).length > 0 ) {
        const requiredKeys = ['englishSSCE','utmeCutOff','mathsSSCE', 'state','jambScore','interestedCourses'];
        let updatedKeys  = [];

        for (let key in to) {
            if(requiredKeys.includes(key)) {
                updatedKeys.push(key);
            }
        }
        console.log(`Updated Keys ${updatedKeys}`);

        if(updatedKeys.length > 0 ) {
            let institutions = [];
            return admin.firestore().collection('federal-universities').get()
                .then(snapshot  => {
                    if (snapshot.empty) {
                        console.log('No matching documents.');
                        return;
                    }
                    snapshot.forEach(doc => {
                        let institutionsObj = doc.data();
                        institutionsObj.id = doc.id;
                        institutions.push(institutionsObj);
                    });

                    let institutionsEligible = [];
                    if(updatedKeys.includes(requiredKeys[5])) {
                        //Check for availability of interested courses that was updated
                        for (let institution of institutions) {
                            //Check all institutions courses for user interested course
                            const institutionCourses = institution.coursesOffered;
                            let coursesAvailableArray = [];
                            for (let course of to.interestedCourses) {
                                //Check if user choice of course is available in institutions
                                if(institutionCourses.includes(course)) {
                                    coursesAvailableArray.push(course);
                                }
                            }
                            if(coursesAvailableArray.length > 0 ){
                                //Was any course available for user in school?
                                if(updatedKeys.includes(requiredKeys[4])) {
                                    //Does user pass Jamb Cut off?
                                    if(institution.utmeCutOff === null) {
                                        institutionsEligible.push({
                                            institution:institution,
                                            courses: coursesAvailableArray
                                        });
                                        //console.log(`${institution.name} offers ${coursesAvailableArray} with no cutoff`);
                                    }else if(institution.utmeCutOff <= to.jambScore) {
                                        institutionsEligible.push({
                                            institution:institution,
                                            courses: coursesAvailableArray
                                        });
                                        //console.log(`${institution.name} offers ${coursesAvailableArray} with user made cutoff`);
                                    }else {
                                        //console.log(`${institution.name} offers ${coursesAvailableArray} but user did not make cut off`);
                                    }
                                }
                            }
                        }
                    }
                    console.log(institutionsEligible);
                    if(institutionsEligible.length > 0) {
                        //Write to recommendations
                        let batch = admin.firestore().batch();
                        for (let item of institutionsEligible) {                            
                            const data = {
                                userId: userId,
                                institutionId: item.institution.id,
                                institution: item.institution.name,
                                courses: item.courses,                    
                                dateCreated: admin.firestore.FieldValue.serverTimestamp(),                            
                            };
                            const recommendationRef = admin.firestore().collection('recommendations').doc();
                            batch.set(recommendationRef, data);
                        }
                        // Commit the batch
                        return batch.commit().then( () => {
                            return 'Recommendations saved';
                        }).catch((err) =>{
                            console.log(err);
                        });
                    }
                    return null;
                });
        }
    }
    return null;
});
