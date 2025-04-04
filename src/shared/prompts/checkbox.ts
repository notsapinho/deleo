import {
    createPrompt,
    isDownKey,
    isEnterKey,
    isNumberKey,
    isSpaceKey,
    isUpKey,
    Separator,
    useKeypress,
    usePagination,
    usePrefix,
    useState
} from "@inquirer/core";
import ansiEscapes from "ansi-escapes";
import chalk from "chalk";
import figures from "figures";

export type Choice<Value> = {
    name?: string;
    value: Value;
    disabled?: boolean | string;
    checked?: boolean;
    type?: never;
};

type Config<Value> = {
    prefix?: string;
    pageSize?: number;
    instructions?: string | boolean;
    message: string;
    default?: ReadonlyArray<Value>;
    choices: ReadonlyArray<Choice<Value> | Separator>;
    transformer?: (choices: ReadonlyArray<Choice<Value>>) => string;
};

function isSelectableChoice<T>(
    choice: undefined | Separator | Choice<T>
): choice is Choice<T> {
    return choice != null && !Separator.isSeparator(choice) && !choice.disabled;
}

export default createPrompt(
    <Value extends unknown>(
        config: Config<Value>,
        done: (value: Array<Value>) => void
    ): string => {
        const { prefix = usePrefix(), instructions, transformer } = config;

        const [status, setStatus] = useState("pending");
        const [choices, setChoices] = useState<
            Array<Separator | Choice<Value>>
        >(() => config.choices.map((choice) => ({ ...choice })));
        const [cursorPosition, setCursorPosition] = useState(0);
        const [showHelpTip, setShowHelpTip] = useState(true);

        if (config.default) {
            choices.forEach((choice) => {
                if (
                    isSelectableChoice(choice) &&
                    config.default.indexOf(choice.value) >= 0
                ) {
                    choice.checked = true;
                }
            });
        }

        config.default = undefined;

        useKeypress((key) => {
            let newCursorPosition = cursorPosition;
            if (isEnterKey(key)) {
                setStatus("done");
                done(
                    choices
                        .filter(
                            (choice) =>
                                isSelectableChoice(choice) && choice.checked
                        )
                        .map((choice) => (choice as Choice<Value>).value)
                );
            } else if (isUpKey(key) || isDownKey(key)) {
                const offset = isUpKey(key) ? -1 : 1;
                let selectedOption: Separator | Choice<any>;

                while (!isSelectableChoice(selectedOption)) {
                    newCursorPosition =
                        (newCursorPosition + offset + choices.length) %
                        choices.length;
                    selectedOption = choices[newCursorPosition];
                }

                setCursorPosition(newCursorPosition);
            } else if (isSpaceKey(key)) {
                setShowHelpTip(false);
                setChoices(
                    choices.map((choice, i) => {
                        if (
                            i === cursorPosition &&
                            isSelectableChoice(choice)
                        ) {
                            return { ...choice, checked: !choice.checked };
                        }

                        return choice;
                    })
                );
            } else if (key.name === "a") {
                const selectAll = Boolean(
                    choices.find(
                        (choice) =>
                            isSelectableChoice(choice) && !choice.checked
                    )
                );
                setChoices(
                    choices.map((choice) =>
                        isSelectableChoice(choice)
                            ? { ...choice, checked: selectAll }
                            : choice
                    )
                );
            } else if (key.name === "i") {
                setChoices(
                    choices.map((choice) =>
                        isSelectableChoice(choice)
                            ? { ...choice, checked: !choice.checked }
                            : choice
                    )
                );
            } else if (isNumberKey(key)) {
                // Adjust index to start at 1
                const position = Number(key.name) - 1;

                // Abort if the choice doesn't exists or if disabled
                if (!isSelectableChoice(choices[position])) {
                    return;
                }

                setCursorPosition(position);
                setChoices(
                    choices.map((choice, i) => {
                        if (i === position && isSelectableChoice(choice)) {
                            return { ...choice, checked: !choice.checked };
                        }

                        return choice;
                    })
                );
            }
        });

        const message = chalk.bold(config.message);
        const allChoices = choices
            .map((choice, index) => {
                if (Separator.isSeparator(choice)) {
                    return ` ${choice.separator}`;
                }

                const line = choice.name || choice.value;
                if (choice.disabled) {
                    const disabledLabel =
                        typeof choice.disabled === "string"
                            ? choice.disabled
                            : "(disabled)";
                    return chalk.dim(`- ${line} ${disabledLabel}`);
                }

                const checkbox = choice.checked
                    ? chalk.green(figures.circleFilled)
                    : figures.circle;
                if (index === cursorPosition) {
                    return chalk.cyan(`${figures.pointer}${checkbox} ${line}`);
                }

                return ` ${checkbox} ${line}`;
            })
            .join("\n");
        const windowedChoices = usePagination(allChoices, {
            active: cursorPosition,
            pageSize: config.pageSize
        });

        if (status === "done") {
            const selections = choices.filter(
                (choice) => isSelectableChoice(choice) && choice.checked
            );

            let result: string = "";

            if (transformer) {
                result = transformer(selections as Choice<Value>[]);
            } else {
                result = selections
                    .map(
                        (choice) =>
                            (choice as Choice<Value>).name ||
                            (choice as Choice<Value>).value
                    )
                    .join(", ");
            }

            return `${prefix} ${message} ${result}`;
        }

        let helpTip = "";
        if (showHelpTip && (instructions === undefined || instructions)) {
            if (typeof instructions === "string") {
                helpTip = instructions;
            } else {
                const keys = [
                    `${chalk.cyan.bold("<space>")} to select`,
                    `${chalk.cyan.bold("<a>")} to toggle all`,
                    `${chalk.cyan.bold("<i>")} to invert selection`,
                    `and ${chalk.cyan.bold("<enter>")} to proceed`
                ];
                helpTip = ` (Press ${keys.join(", ")})`;
            }
        }

        return `${prefix} ${message}${helpTip}\n${windowedChoices}${ansiEscapes.cursorHide}`;
    }
);

export { Separator };
