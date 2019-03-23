// ------------------------------------------------------------------
// APP INITIALIZATION
// ------------------------------------------------------------------

import { App } from 'jovo-framework';
import { Alexa } from 'jovo-platform-alexa';
import { GoogleAssistant } from 'jovo-platform-googleassistant';
import { JovoDebugger } from 'jovo-plugin-debugger';
import { FileDb } from 'jovo-db-filedb';
import { EventModel } from './EventModel';
import { AttendeeModel } from './AttendeeModel';

const requestPromise = require('request-promise-native');

const app = new App();

app.use(new Alexa(), new GoogleAssistant(), new JovoDebugger(), new FileDb());

// ------------------------------------------------------------------
// APP LOGIC
// ------------------------------------------------------------------

app.setHandler({
    LAUNCH() {
        this.$user.$data.failures = 0;
        this.toIntent('WelcomeIntent');
    },

    MyNameIsIntent() {
        this.$user.$data.firstName = this.$inputs.firstName.value;
        this.ask(
            'Hello ' +
            this.$inputs.firstname.value +
            ' ' +
            this.$inputs.lastname.value +
            '. What Event do you wish to attend?',
            'Please tell me the event you wish to attend'
        );
    },

    WelcomeIntent() {
        let speech =
            "Welcome, I am your receptionist for today. What's your name?";
        let reprompt = 'Please tell me your name?';
        this.ask(speech, reprompt);
    },

    EventState: {
        async YesIntent() {
            const events = await getEvents();
            const eventNames = [];
            for (const event of events) {
                eventNames.push(event.name);
            }
            // @ts-ignore
            let speech = this.speechBuilder();
            for (const eventName of eventNames) {
                // @ts-ignore
                speech.addText(eventName + ', ');
            }

            // @ts-ignore
            speech
                .addBreak('1000ms')
                .addText('To which of these events do you want to go?');
            // @ts-ignore
            this.ask(speech, 'Please tell me to which you want to go');
            this.toIntent('EventIntent');
        },

        NoIntent() {
            this.tell("Okay, I am sorry, that I could'nt help you");
        }
    },

    async EventIntent() {
        const events = await getEvents();
        let foundEvent = events.filter(event =>
            event.name.includes(this.$inputs.eventName.value)
        )[0];
        if (foundEvent) {
            if (await validateAttendee(foundEvent.id)) {
                switch (foundEvent.type) {
                    case 'conference': {
                        this.tell(
                            'Great, I was able to find you in my notes. Your conference is held at room ' +
                            foundEvent.location
                        );
                        break;
                    }
                    case 'appointment': {
                        this.tell(
                            'Great, I was able to find you in my notes. ' +
                            foundEvent.contactPerson +
                            ' has been contacted and is on the way to welcome you'
                        );
                        break;
                    }
                    default: {
                        this.tell(
                            'Great, I was able to find you in my notes. Your event is held at ' +
                            foundEvent.location
                        );
                    }
                }
            }
        } else {
            this.$user.$data.failures++;
            if (this.$user.$data.failures <= 2) {
                let speech =
                    'Sorry, I could not find your Event. Do you want me to tell you, which Events are available?';
                this.followUpState('EventState').ask(
                    speech,
                    'Please answer with yes or no.'
                );
            } else {
                this.tell(
                    "I'm sorry, I am not able to help you. A employee has been notified and will will take care of you."
                );
            }
        }
    }
});

async function getEvents(): Promise<EventModel[]> {
    const options = {
        uri: 'http://localhost:5000/events',
        json: true
    };
    return await requestPromise(options);
}

async function validateAttendee(eventID: string) {
    const options = {
        uri: `http://localhost:5000/${eventID}/validate`,
        json: true,
        method: 'POST',
        resolveWithFullResponse: true,
        body: {
            // @ts-ignore
            firstName: this.$user.$data.firstName,
            // @ts-ignore
            lastName: this.$user.$data.lastName
        }
    };
    const response = await requestPromise(options);
    console.log('-----------------');
    console.log(response);
    console.log('-----------------');
    return response.statusCode === 200
}

module.exports.app = app;
