# Home Assignment – Senior Full Stack Developer

## Rounds Full Stack Test Project

In this test project you will design and implement a small **marketing competition monitoring system** for Android applications.

## How the System Works

Create an API or a dedicated UI screen that will allow users to **add / modify which apps to track** (e.g., `https://play.google.com/store/apps/details?id=com.activision.callofduty.shooter`).

Using this list of apps added to the system, the system will **periodically take screenshots** of each app's Google Play listing page and display them to the user on a page in a simple **timeline**.

The user will be able to enter the app monitoring page and view the different screenshots that were taken, seeing what the competitors' apps are changing on their listing page over a period of time, and adjust their marketing strategy accordingly.

Think how to make the app as production-ready as possible.

## Screen Design

Feel free to design the system screens as you see fit. This isn't a design test, so no need to put too much effort on a pretty UI — as long as the system is usable.

### App Monitoring Page

- Display the list of taken screenshots, ordered by creation time descending.
- On the top of each screenshot, provide the screenshot time.

Below is an example layout for reference:

![App Monitoring Page Example](/example-screenshot.png)

## Additional Notes

- No need to implement any user management — imagine the system will be used by only one customer for now.
- **Tech stack:** Please implement the system using **Node.js**, **React**, and **TypeScript**.

## Deliverables

- A new GitHub project with the system code.
- Please provide instructions on how to run the system locally.
- Come prepared to present the assignmet in a follow up techincal interview (20 mins technical demo presentation + 20 mins Q&A).

## Bonus Points

- Deploy the service to the cloud and provide access to it, along with an explanation of how it was deployed.
- The deployment can be in GCP/AWS or other infrastructure providers.
