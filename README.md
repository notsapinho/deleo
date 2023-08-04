# 🗑️ Deleo

Deleo, a Latin term for "I delete", is a simple yet powerful CLI tool developed using TypeScript. It's designed to help Discord users manage their content by facilitating the deletion of messages in open DMs or specified channels.

> ⚠️ **Any tool that automates actions on user accounts, including this one, could result in account termination.** (see [self-bots][self-bots]).  
> Use at your own risk!.

## 🌟 Features

-   📨 Delete messages from open DMs or a specified channel
-   ⏱️ Configurable delay between each message deletion

## 💻 Installation

You can install Deleo globally with npm:

```bash
npm install -g deleo
```

or

```bash
yarn global add deleo
```

## 🚀 Usage

To use Deleo, you need to authenticate with your Discord token. You can do this by using the `auth` command:

```bash
deleo auth <your_discord_token>
```

Then, you can use the `delete` command to delete messages:

```bash
deleo delete
```

You can customize the delay between each message deletion (default is 300ms):

```bash
deleo delete --delete-delay <delay_in_ms>
```

For more information about a command, you can use the `help` command:

```bash
deleo help <command>
```

## 🤝 Contributing

We welcome contributions to Deleo! We welcome contributions to Deleo! Feel free to fork this repository and submit a pull request. If you have any questions or suggestions, you can create an issue.

## 📜 License

Deleo is [MIT licensed](LICENSE).

<!-- links -->

[self-bots]: https://support.discordapp.com/hc/en-us/articles/115002192352-Automated-user-accounts-self-bots-
