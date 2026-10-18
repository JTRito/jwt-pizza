import { test, expect } from 'playwright-test-coverage';
import { Page } from '@playwright/test';
import { Role, User } from '../src/service/pizzaService';

async function mockBackend(page: Page, role: Role = Role.Diner) {
    let user: User | null = null;
    let password = '';

    await page.route('*/**/api/auth', async (route) => {
        const method = route.request().method();

        if (method === 'POST') {
            const registerRequest = route.request().postDataJSON();
            user = {
                id: '1',
                name: registerRequest.name,
                email: registerRequest.email,
                roles: [{ role }],
            };
            password = registerRequest.password;
            await route.fulfill({ json: { user, token: 'test-token' } });
        } else if (method === 'PUT') {
            const loginRequest = route.request().postDataJSON();
            if (!user || loginRequest.email !== user.email || loginRequest.password !== password) {
                await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
                return;
            }
            await route.fulfill({ json: { user, token: 'test-token' } });
        } else if (method === 'DELETE') {
            await route.fulfill({ json: { message: 'logout successful' } });
        }
    });

    await page.route('*/**/api/user/me', async (route) => {
        await route.fulfill({ json: user });
    });

    await page.route('*/**/api/user/1', async (route) => {
        const updatedUser = route.request().postDataJSON();
        user = updatedUser;
        if (updatedUser.password) {
            password = updatedUser.password;
        }
        await route.fulfill({ json: { user, token: 'test-token' } });
    });

    await page.route('*/**/api/order', async (route) => {
        await route.fulfill({ json: { orders: [] } });
    });
}

test('updateUser', async ({ page }) => {
    const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
    await mockBackend(page);
    await page.goto('localhost:5173');
    await page.getByRole('link', { name: 'Register' }).click();
    await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('diner');
    await page.getByRole('button', { name: 'Register' }).click();

    await page.getByRole('link', { name: 'pd' }).click();

    await expect(page.getByRole('main')).toContainText('pizza diner');

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('h3')).toContainText('Edit user');
    await page.getByRole('button', { name: 'Update' }).click();

    await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

    await expect(page.getByRole('main')).toContainText('pizza diner');

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('h3')).toContainText('Edit user');
    await page.getByRole('textbox').first().fill('pizza dinerx');
    await page.getByRole('button', { name: 'Update' }).click();

    await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

    await expect(page.getByRole('main')).toContainText('pizza dinerx');

    await page.getByRole('link', { name: 'Logout' }).click();
    await page.getByRole('link', { name: 'Login' }).click();

    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('diner');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByRole('link', { name: 'pd' }).click();

    await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('updateUserPassword', async ({ page }) => {
    const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
    await mockBackend(page);
    await page.goto('localhost:5173');
    await page.getByRole('link', { name: 'Register' }).click();
    await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('diner');
    await page.getByRole('button', { name: 'Register' }).click();

    await page.getByRole('link', { name: 'pd' }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#password').fill('newdiner');
    await page.getByRole('button', { name: 'Update' }).click();
    await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

    await page.getByRole('link', { name: 'Logout' }).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('newdiner');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('link', { name: 'pd' })).toBeVisible();
});

test('updateUserEmail', async ({ page }) => {
    const oldEmail = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
    const newEmail = `updated${Math.floor(Math.random() * 10000)}@jwt.com`;
    await mockBackend(page);
    await page.goto('localhost:5173');
    await page.getByRole('link', { name: 'Register' }).click();
    await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
    await page.getByRole('textbox', { name: 'Email address' }).fill(oldEmail);
    await page.getByRole('textbox', { name: 'Password' }).fill('diner');
    await page.getByRole('button', { name: 'Register' }).click();

    await page.getByRole('link', { name: 'pd' }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('[role="dialog"] input[type="email"]').fill(newEmail);
    await page.getByRole('button', { name: 'Update' }).click();
    await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

    await page.getByRole('link', { name: 'Logout' }).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill(newEmail);
    await page.getByRole('textbox', { name: 'Password' }).fill('diner');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByRole('link', { name: 'pd' }).click();
    await expect(page.getByRole('main')).toContainText(newEmail);
});

test('updateAdminUserInformation', async ({ page }) => {
    const email = `admin${Math.floor(Math.random() * 10000)}@jwt.com`;
    const updatedEmail = `updatedadmin${Math.floor(Math.random() * 10000)}@jwt.com`;
    const updatedName = 'admin pizza';
    const updatedPassword = 'newadminpassword';

    await mockBackend(page, Role.Admin);
    await page.goto('localhost:5173');
    await page.getByRole('link', { name: 'Register' }).click();
    await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('diner');
    await page.getByRole('button', { name: 'Register' }).click();

    await page.getByRole('link', { name: 'pd' }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('[role="dialog"] input[type="text"]').first().fill(updatedName);
    await page.locator('[role="dialog"] input[type="email"]').fill(updatedEmail);
    await page.locator('#password').fill(updatedPassword);
    await page.getByRole('button', { name: 'Update' }).click();
    await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

    await page.getByRole('link', { name: 'Logout' }).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill(updatedEmail);
    await page.getByRole('textbox', { name: 'Password' }).fill(updatedPassword);
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByRole('link', { name: 'ap' }).click();
    await expect(page.getByRole('main')).toContainText(updatedName);
    await expect(page.getByRole('main')).toContainText(updatedEmail);
    await expect(page.getByRole('main')).toContainText(Role.Admin);
});

