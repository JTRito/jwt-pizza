import { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page, additionalUsers: User[] = []) {
    let loggedInUser: User | undefined;
    let franchises = [
        {
            id: 2,
            name: 'LotaPizza',
            stores: [
                { id: 4, name: 'Lehi' },
                { id: 5, name: 'Springville' },
                { id: 6, name: 'American Fork' },
            ],
        },
        { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
        { id: 4, name: 'topSpot', stores: [] },
    ]
    const validUsers: Record<string, User> = {
        'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
        'a@jwt.com': { id: '4', name: 'Admi Nstrator', email: 'a@jwt.com', password: 'a', roles: [{ role: Role.Admin }] }
    };
    const userPages: User[][] = [
        [
            { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] },
            { id: '5', name: 'Buddy', email: 'b@jwt.com', roles: [{ role: Role.Admin }] },
            ...additionalUsers,
        ],
        [{ id: '6', name: 'Mia Stone', email: 'm@jwt.com', roles: [{ role: Role.Franchisee }] }],
    ];

    await page.route('*/**/api/auth', async (route) => {
        const method = route.request().method();

        if (method === 'PUT') {
            const loginReq = route.request().postDataJSON();
            const user = validUsers[loginReq.email];
            if (!user || user.password !== loginReq.password) {
                await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
                return;
            }
            loggedInUser = validUsers[loginReq.email];
            const loginRes = {
                user: loggedInUser,
                token: 'abcdef',
            };
            expect(route.request().method()).toBe('PUT');
            await route.fulfill({ json: loginRes });
        } else if (method === 'DELETE') {
            const logoutRes = {
                message: 'logout successful'
            }
            expect(route.request().method()).toBe('DELETE');
            await route.fulfill({ json: logoutRes });
        } else if (method === 'POST') {
            const registerReq = route.request().postDataJSON();
            const user = { id: '5', name: 'test user', email: 't@jwt.com', roles: [{ role: Role.Diner }]}; 
            loggedInUser = user;
            const registerRes = {
                user: user, token: 'tttttt'
            };
            await route.fulfill({json: registerRes})
        }
    });

    await page.route('*/**/api/user/me', async (route) => {
        expect(route.request().method()).toBe('GET');
        await route.fulfill({ json: loggedInUser });
    });

    await page.route(/\/api\/user(?:\?.*)?$/, async (route) => {
        expect(route.request().method()).toBe('GET');
        const pageNumber = Number(new URL(route.request().url()).searchParams.get('page') ?? 0);
        const users = userPages[pageNumber] ?? [];
        await route.fulfill({
            json: {
                users,
                more: pageNumber === 0,
            },
        });
    });

    await page.route(/\/api\/user\/\d+$/, async (route) => {
        expect(route.request().method()).toBe('DELETE');
        const userId = new URL(route.request().url()).pathname.split('/').pop();
        for (const users of userPages) {
            const userIndex = users.findIndex((user) => user.id === userId);
            if (userIndex !== -1) {
                users.splice(userIndex, 1);
                break;
            }
        }
        await route.fulfill({ json: { message: 'user deleted' } });
    });

    await page.route('*/**/api/order/menu', async (route) => {
        const menuRes = [
            { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
            { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
        ];
        expect(route.request().method()).toBe('GET');
        await route.fulfill({ json: menuRes });
    });

    await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
        if (route.request().method() === 'GET') {
            const franchiseRes = {
                franchises: franchises,
            };
            expect(route.request().method()).toBe('GET');
            await route.fulfill({ json: franchiseRes });
        } else if (route.request().method() == 'POST') {
            const newFranchise = {
                id: 5, name: 'test', stores: []
            };
            franchises.push(newFranchise);
            const franchiseRes = { name: 'test', admins: [{ email: 'a@jwt.com', id: 4, name: 'Admi Nstrator' }], id: 5 };
            expect(route.request().method()).toBe('POST');
            await route.fulfill({ json: franchiseRes });
        }
    });

    await page.route(/\/api\/franchise\/5/, async (route) => {
        franchises.splice(3, 1);
        expect(route.request().method()).toBe('DELETE');
        const franchiseRes = { message: 'franchise deleted' };
        await route.fulfill({ json: franchiseRes });
    });

    await page.route('*/**/api/order', async (route) => {
        const method = route.request().method();
        if (method == 'POST') {
            const orderReq = route.request().postDataJSON();
            const orderRes = {
                order: { ...orderReq, id: 23 },
                jwt: 'eyJpYXQ',
            };
            expect(method).toBe('POST');
            await route.fulfill({ json: orderRes });
        }
        else if (method == 'GET') {
            const orderReq = route.request().postDataJSON();
            const orderRes = {
                dinerId: 3,
                orders: [{
                    id: 1,
                    franchiseId: 2,
                    storeId: 4,
                    date: '2024-06-05T05:14:40.000Z',
                    items: [{
                        id: 1,
                        menuId: 1,
                        description: 'Veggie',
                        price: 0.05
                    }]
                }],
                page: 1
            }
            expect(method).toBe('GET');
            await route.fulfill({ json: orderRes });
        }
    })


    await page.route('*/**/api/franchise/3', async (route) => {
        await route.fulfill({});
    })

    await page.goto('localhost:5173');
}

test('login', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('button', { name: 'Order now' }).click();

    await expect(page.locator('h2')).toContainText('Awesome is a click away');
    await page.getByRole('combobox').selectOption('4');
    await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
    await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
    await expect(page.locator('form')).toContainText('Selected pizzas: 2');
    await page.getByRole('button', { name: 'Checkout' }).click();

    await page.getByPlaceholder('Email address').fill('d@jwt.com');
    await page.getByPlaceholder('Password').fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
    await expect(page.locator('tbody')).toContainText('Veggie');
    await expect(page.locator('tbody')).toContainText('Pepperoni');
    await expect(page.locator('tfoot')).toContainText('0.008 ₿');
    await page.getByRole('button', { name: 'Pay now' }).click();

    await expect(page).toHaveURL(/.*delivery/);
    await expect(page.getByText('0.008')).toBeVisible();
});

test('logout', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByRole('link', { name: 'Logout' }).click();

    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();

})

test('admin page visible', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByText('Mama Ricci\'s kitchen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Franchises', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Franchise', exact: true })).toBeVisible();


    await page.getByRole('button', { name: 'Add Franchise' }).click();
    await expect(page.getByText('Create franchise', { exact: true })).toBeVisible();
    await expect(page.getByText('Want to create franchise?')).toBeVisible();
})

test('admin user list visible', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();

    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
    const userTable = page.getByRole('table').filter({
        has: page.getByRole('columnheader', { name: 'Name', exact: true }),
    });
    await expect(userTable.getByRole('columnheader', { name: 'Email', exact: true })).toBeVisible();
    await expect(userTable.getByRole('columnheader', { name: 'Role', exact: true })).toBeVisible();
    await expect(userTable.getByRole('cell', { name: 'Kai Chen', exact: true })).toBeVisible();
    await expect(userTable.getByRole('cell', { name: 'd@jwt.com', exact: true })).toBeVisible();
    await expect(userTable.getByRole('cell', { name: Role.Diner, exact: true })).toBeVisible();
});

test('admin can search users by name', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();

    const userTable = page.getByRole('table').filter({
        has: page.getByRole('columnheader', { name: 'Name', exact: true }),
    });
    await page.getByRole('textbox', { name: 'Search users' }).fill('Buddy');
    await userTable.getByRole('button', { name: 'Search', exact: true }).click();

    await expect(userTable.getByRole('cell', { name: 'Buddy', exact: true })).toBeVisible();
    await expect(userTable.getByRole('cell', { name: 'Kai Chen', exact: true })).toBeHidden();
});

test('admin can navigate between user pages', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();

    const userTable = page.getByRole('table').filter({
        has: page.getByRole('columnheader', { name: 'Name', exact: true }),
    });
    await expect(userTable.getByRole('cell', { name: 'Kai Chen', exact: true })).toBeVisible();

    await userTable.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(userTable.getByRole('cell', { name: 'Mia Stone', exact: true })).toBeVisible();
    await expect(userTable.getByRole('cell', { name: 'Kai Chen', exact: true })).toBeHidden();

    await userTable.getByRole('button', { name: 'Prev', exact: true }).click();
    await expect(userTable.getByRole('cell', { name: 'Kai Chen', exact: true })).toBeVisible();
    await expect(userTable.getByRole('cell', { name: 'Mia Stone', exact: true })).toBeHidden();
});

test('admin can delete a user from the list', async ({ page }) => {
    const insertedUser: User = {
        id: '7',
        name: 'Delete Me',
        email: 'delete-me@jwt.com',
        roles: [{ role: Role.Diner }],
    };
    await basicInit(page, [insertedUser]);

    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();

    const userTable = page.getByRole('table').filter({
        has: page.getByRole('columnheader', { name: 'Name', exact: true }),
    });
    await expect(userTable.getByRole('cell', { name: insertedUser.name, exact: true })).toBeVisible();
    await userTable.getByRole('button', { name: `Delete ${insertedUser.name}` }).click();

    await expect(userTable.getByRole('cell', { name: insertedUser.name, exact: true })).toBeHidden();
});

test('about visible', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();

    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByText('The secret sauce')).toBeVisible();
    await expect(page.getByRole('img').nth(3)).toBeVisible();
    await page.getByRole('heading', { name: 'Our employees' }).click();
    await expect(page.getByRole('main')).toContainText('Our employees');
    await expect(page.getByRole('img', { name: 'Employee stock photo' }).nth(3)).toBeVisible();
})

test('create then close franchise', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('link', { name: 'Login' }).click();

    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();

    await page.getByRole('button', { name: 'Add Franchise' }).click();
    await page.getByRole('textbox', { name: 'franchise name' }).fill('test');
    await page.getByRole('textbox', { name: 'franchisee admin email' }).fill('a@jwt.com');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('cell', { name: 'test' })).toBeVisible();

    await page.locator('tbody:nth-child(5) > .border-neutral-500 > .px-6 > .px-2').click();

    await expect(page.getByText('Sorry to see you go')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
})

test('franchise dashboard from diner pov', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();


    await page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Franchise' }).click();
    await expect(page.getByText('If you are already a')).toBeVisible();
    await expect(page.getByRole('list')).toContainText('franchise-dashboard');
    await expect(page.locator('tbody')).toContainText('2022');
    await expect(page.getByRole('main')).toContainText('Unleash Your Potential');
})

test('history', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('textbox', { name: 'Password' }).press('Enter');

    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.getByText('Mama Rucci, my my')).toBeVisible();
    await expect(page.getByRole('main').getByRole('img')).toBeVisible();
    await expect(page.getByRole('main')).toContainText('It all started in Mama Ricci\'s kitchen. She would delight all of the cousins with a hot pie in any style they could think of Milanese, Chicago deep dish, Detroit square pan, Neapolitan, or even fusion flatbread.Pizza has a long and rich history that dates back thousands of years. Its origins can be traced back to ancient civilizations such as the Egyptians, Greeks, and Romans. The ancient Egyptians were known to bake flatbreads topped with various ingredients, similar to modern-day pizza. In ancient Greece, they had a dish called "plakous" which consisted of flatbread topped with olive oil, herbs, and cheese.However, it was the Romans who truly popularized pizza-like dishes. They would top their flatbreads with various ingredients such as cheese, honey, and bay leaves.Fast forward to the 18th century in Naples, Italy, where the modern pizza as we know it today was born. Neapolitan pizza was typically topped with tomatoes, mozzarella cheese, and basil. It quickly became a favorite among the working class due to its affordability and delicious taste. In the late 19th century, pizza made its way to the United States through Italian immigrants.It gained popularity in cities like New York and Chicago, where pizzerias started popping up. Today, pizza is enjoyed worldwide and comes in countless variations and flavors. However, the classic Neapolitan pizza is still a favorite among many pizza enthusiasts. This is especially true if it comes from JWT Pizza!');

})

test('diner dashboard', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('textbox', { name: 'Password' }).press('Enter');

    await page.getByRole('link', { name: 'KC' }).click();
    await expect(page.getByRole('heading')).toContainText('Your pizza kitchen');
    await expect(page.getByRole('main')).toContainText('d@jwt.com');
})

test('register user', async ({ page }) => {
    await basicInit(page);

    
    await page.getByRole('link', { name: 'Register' }).click();
    
    
    await page.getByRole('textbox', { name: 'Full name' }).fill('test user');
    await page.getByRole('textbox', { name: 'Email address' }).fill('t@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByRole('link', { name: 'tu' })).toBeVisible();
})


test('not found', async ({page}) => {
    await basicInit(page);
    
    await page.goto('http://localhost:5173/adsfjkalksdfjas');
    await expect(page.getByRole('heading')).toContainText('Oops');
})
