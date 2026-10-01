import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Message } from "@/src/api";
import { Avatar, Loader, Notice } from "@/src/components/ui";
import { loadUser } from "@/src/session";
import { makeStyles, useTheme } from "@/src/theme";

export default function ChatScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name, initials } = useLocalSearchParams<{ id: string; name?: string; initials?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setMessages(await api.messages(id));
    } catch (error) {
      if (!silent) setNotice(error instanceof Error ? error.message : "No pudimos cargar los mensajes");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadUser().then((user) => setUserId(user?.id ?? ""));
    load();
    const interval = setInterval(() => load(true), 4000);
    return () => clearInterval(interval);
  }, [load]);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await api.sendMessage(id, value);
      setText("");
      await load(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="chat-back-button" onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Avatar initials={initials ?? "??"} size={38} />
        <Text testID="chat-header-name" style={styles.headerName} numberOfLines={1}>{name ?? "Conversación"}</Text>
      </View>
      {notice ? <Notice text={notice} onClose={() => setNotice("")} /> : null}
      <KeyboardAvoidingView behavior="translate-with-padding" style={styles.flex}>
        {loading ? (
          <Loader />
        ) : (
          <FlatList
            ref={listRef}
            testID="messages-list"
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.brandPrimary} />
                <Text style={styles.emptyText}>Inicia la conversación con un mensaje de saludo.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === userId;
              return (
                <View testID={`message-${item.id}`} style={[styles.bubble, mine && styles.bubbleMine]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
                </View>
              );
            }}
          />
        )}
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.muted}
            style={styles.composerInput}
            multiline
          />
          <Pressable testID="chat-send-button" onPress={send} disabled={sending || !text.trim()} style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]}>
            {sending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Ionicons name="send" size={17} color={colors.onBrandPrimary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headerName: { color: colors.onSurface, fontSize: 16, fontWeight: "700", flex: 1 },
  messageList: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 8, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 60 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start" },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  bubbleText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: colors.onBrandPrimary },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  composerInput: { flex: 1, minHeight: 42, maxHeight: 110, borderRadius: 21, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 11, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, fontSize: 14 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary, marginBottom: 1 },
}));
