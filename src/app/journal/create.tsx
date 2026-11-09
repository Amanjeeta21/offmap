import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useJournals } from "@/context/journal-context";

export default function CreateJournalScreen() {
  const router = useRouter();
  const { addJournal } = useJournals();

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCoverImage(result.assets[0].uri);
    }
  }

  function createJournal() {
    if (!title.trim() || !destination.trim()) {
      Alert.alert("Missing details", "Add a journal name and destination.");
      return;
    }

    addJournal({
      title: title.trim(),
      destination: destination.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      description: description.trim() || "A new adventure begins.",
      coverImage,
    });

    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>A NEW CHAPTER</Text>
        <Text style={styles.heading}>Create your journal</Text>

        <Input
          label="JOURNAL NAME *"
          value={title}
          onChangeText={setTitle}
          placeholder="My Rajasthan Diaries"
        />

        <Input
          label="DESTINATION *"
          value={destination}
          onChangeText={setDestination}
          placeholder="Jaipur, Rajasthan"
        />

        <Input
          label="START DATE"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="12 Dec 2026"
        />

        <Input
          label="END DATE"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="15 Dec 2026"
        />

        <Input
          label="DESCRIPTION"
          value={description}
          onChangeText={setDescription}
          placeholder="What makes this trip special?"
        />

        <Text style={styles.label}>COVER PHOTO</Text>

        <Pressable style={styles.imageBox} onPress={chooseImage}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.image} />
          ) : (
            <>
              <Text style={styles.plus}>＋</Text>
              <Text style={styles.imageText}>Choose from gallery</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.button} onPress={createJournal}>
          <Text style={styles.buttonText}>Create my journal →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A49D91"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  back: {
    color: Colors.accent,
    fontSize: 13,
    marginBottom: 30,
  },
  eyebrow: {
    color: Colors.accent,
    fontSize: 9,
    letterSpacing: 2,
  },
  heading: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 28,
    marginTop: 10,
    marginBottom: 25,
  },
  label: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 7,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    color: Colors.primary,
    fontSize: 14,
    paddingVertical: 9,
  },
  imageBox: {
    height: 150,
    backgroundColor: "#F0ECE4",
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  plus: {
    color: Colors.accent,
    fontSize: 28,
  },
  imageText: {
    color: Colors.primary,
    fontSize: 12,
    marginTop: 5,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: Radius.sm,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
