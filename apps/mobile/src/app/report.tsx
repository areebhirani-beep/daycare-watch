import * as WebBrowser from 'expo-web-browser';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { SectionHeader } from '@/components/ui/Chrome';
import { RightCard } from '@/components/ui/RightCard';
import { Text } from '@/components/ui/Text';
import { space, useColors } from '@/theme';

// Every number and URL here is a verified row in docs/OFFICIAL_SOURCES.md section 1 (Oct 24 2026).
const HOTLINE = '18002525400';
const CCR_FORM = 'https://childcare.hhs.texas.gov/Public/makeAReport';
const HOTLINE_WEB = 'https://www.txabusehotline.org/Login/Default.aspx';
const PLANO_OFFICE = '4692296900,6901';

const CALL = 'Starts a phone call';
const WEB = 'Opens the state website';

export default function ReportScreen() {
  const c = useColors();
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <Text variant="callout" tone="secondary">
        The State of Texas&rsquo;s own channels. This app doesn&rsquo;t receive or forward reports.
      </Text>

      <View style={styles.section}>
        <SectionHeader title="A child is in danger right now" inset={0} />
        <RightCard
          icon="phone"
          title="Call 911"
          detail="Emergencies and life-threatening situations"
          hint={CALL}
          trailing="chevronRight"
          onPress={() => void Linking.openURL('tel:911')}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Suspected abuse or neglect" inset={0} />
        <RightCard
          icon="phone"
          title="Texas Abuse Hotline"
          detail="1-800-252-5400 · 24 hours a day, 7 days a week"
          hint={CALL}
          trailing="chevronRight"
          onPress={() => void Linking.openURL(`tel:${HOTLINE}`)}
        />
        <RightCard
          icon="doc"
          title="Report online"
          detail="TxAbuseHotline.org · not for urgent situations"
          hint={WEB}
          trailing="external"
          onPress={() => void WebBrowser.openBrowserAsync(HOTLINE_WEB)}
        />
        <Text variant="footnote" tone="tertiary">
          The state does not accept anonymous abuse or neglect reports. Deaf or hard of hearing callers can use Relay
          Texas at 7-1-1.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="A daycare isn’t following the rules" inset={0} />
        <RightCard
          icon="doc"
          title="Child Care Regulation report form"
          detail="Texas Health and Human Services"
          hint={WEB}
          trailing="external"
          onPress={() => void WebBrowser.openBrowserAsync(CCR_FORM)}
        />
        <RightCard
          icon="phone"
          title="Local Child Care Regulation office"
          detail="Plano · 469-229-6900 ext. 6901 · weekdays"
          hint={CALL}
          trailing="chevronRight"
          onPress={() => void Linking.openURL(`tel:${PLANO_OFFICE}`)}
        />
        <Text variant="footnote" tone="tertiary">
          The form asks for your name. To report anonymously, call the local office. For abuse or neglect, use the
          hotline above.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.section },
  section: { gap: 10 },
});
