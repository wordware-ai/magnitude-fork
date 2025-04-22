import { test } from 'magnitude-test';

// test('bogus')
//     .step('do nothin')
//         .check('picture of a sloth is visible')
//     //.step('click on the sloth')
//     .step('create a todo')
//         .data("Pay Anthropic bill")
//         .check('see todo')


// test('can add and complete todos')
//     .step('create a todos')
//         .data('Buy groceries')
//         .check('should see a todo')

test('scroll test', { url: 'https://en.wikipedia.org/wiki/Sloth' })
    .step('Scroll to bottom')
