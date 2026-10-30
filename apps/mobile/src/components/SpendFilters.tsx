import type { FilterOption, SpendFilter } from "@lofit/view";
import { isFiltered, NO_FILTER, toggled, topTags } from "@lofit/view";
import { Search } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import type { Colors } from "../theme";
import { useStyles, useTheme } from "../theme";
import { Chip, ChipRow } from "./Choices";
import { makeFieldStyles } from "./Field";

type Props = {
    filter: SpendFilter;
    options: { tags: FilterOption[]; accounts: FilterOption[] };
    usage: ReadonlyMap<string, number>;
    onChange: (filter: SpendFilter) => void;
};

const TAGS_SHOWN = 6;

export function SpendFilters({ filter, options, usage, onChange }: Props) {
    const [expanded, setExpanded] = useState(false);
    const ranked = topTags(options.tags, usage, TAGS_SHOWN, filter.tagIds);
    const tagOptions = expanded ? options.tags : ranked.visible;
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const accounts = options.accounts.length > 1 ? options.accounts : [];
    return (
        <View style={styles.wrap}>
            <View>
                <TextInput
                    style={styles.input}
                    value={filter.query}
                    onChangeText={(query) => onChange({ ...filter, query })}
                    placeholder="Name, tag, or amount"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="Search this month"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
                <View style={styles.icon} pointerEvents="none">
                    <Search size={15} strokeWidth={1.5} color={colors.quiet} />
                </View>
            </View>
            {(options.tags.length > 0 || accounts.length > 0) && (
                <ChipRow scroll>
                    {isFiltered(filter) && <Chip label="Clear" strong onPress={() => onChange(NO_FILTER)} />}
                    {tagOptions.map((option) => (
                        <Chip
                            key={option.id}
                            label={option.label}
                            selected={filter.tagIds.includes(option.id)}
                            onPress={() => onChange({ ...filter, tagIds: toggled(filter.tagIds, option.id) })}
                        />
                    ))}
                    {!expanded && ranked.hidden > 0 && (
                        <Chip label={`+${ranked.hidden} more`} onPress={() => setExpanded(true)} />
                    )}
                    {accounts.length > 0 && <View style={styles.sep} />}
                    {accounts.map((option) => (
                        <Chip
                            key={option.id}
                            label={option.label}
                            selected={filter.accountIds.includes(option.id)}
                            onPress={() => onChange({ ...filter, accountIds: toggled(filter.accountIds, option.id) })}
                        />
                    ))}
                </ChipRow>
            )}
        </View>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        wrap: { gap: 10 },
        input: { ...makeFieldStyles(colors).input, paddingLeft: 34 },
        icon: { position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center" },
        sep: { width: StyleSheet.hairlineWidth, height: 18, marginHorizontal: 4, backgroundColor: colors.divider },
    });
