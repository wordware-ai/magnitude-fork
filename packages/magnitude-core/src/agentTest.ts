import { TestCaseAgent } from "./agent";

async function main() {
    const agent = new TestCaseAgent();

    const result = await agent.run({
        url: "https://qa-bench.com",
        steps: [
            {
                description: "Log in",
                checks: ["Can see dashboard"],
                testData: {
                    data: [
                        { key: "username", value: "test-user@magnitude.run", sensitive: false },
                        { key: "password", value: "test", sensitive: true },
                    ] 
                }
            },
            // BOTH parts of this one will fail: it doesnt yet know what company form looks like
            { description: "Create an example company", checks: ["Example company exists"], testData: {} } // THIS will fail without check adaptation
        ]
    });

    // HARD
    // const result = await agent.run({
    //     url: "https://app.pickcode.io/lessons",
    //     steps: [
    //         { description: "Start the cookie clicker lesson", checks: [] },
    //         { description: "Follow the entire lesson", checks: [] }
    //     ]
    // });

    console.log("Result:", result);
}

main();